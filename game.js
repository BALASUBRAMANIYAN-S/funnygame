/**
 * RUNNER - Custom Chrome Dino Game Engine
 * Features real character cutout head with animated skeletal runner,
 * day/night cycle, parallax desert landscape, dynamic audio synthesizer,
 * responsive controls, and high score tracking.
 */

// --- AUDIO SYSTEM (Web Audio API - Zero External Dependencies) ---
class SoundSystem {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('kpr_runner_muted') === 'true';
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('kpr_runner_muted', this.muted);
    return this.muted;
  }

  playJump() {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';

      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.12);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) { }
  }

  playDuck() {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';

      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
    } catch (e) { }
  }

  playMilestone() {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [880, 1174.6].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        gain.gain.setValueAtTime(0.12, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.09 + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.13);
      });
    } catch (e) { }
  }

  playHit() {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';

      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.28);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) { }
  }
}

// --- PARTICLE SYSTEM ---
class Particle {
  constructor(x, y, vx, vy, size, color, life, shrink = true) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.size = size;
    this.color = color;
    this.maxLife = life;
    this.life = life;
    this.shrink = shrink;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    const r = this.shrink ? this.size * alpha : this.size;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0.5, r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// --- CHARACTER CLASS ---
class Runner {
  constructor(groundY) {
    this.groundY = groundY;
    this.x = 90;
    this.y = groundY;
    this.vy = 0;
    this.gravity = 0.72;
    this.jumpForce = -14.2;

    // Normal size
    this.standWidth = 46;
    this.standHeight = 98;
    // Duck size
    this.duckWidth = 62;
    this.duckHeight = 56;

    this.width = this.standWidth;
    this.height = this.standHeight;

    this.isGrounded = true;
    this.isDucking = false;
    this.isHit = false;

    this.runCycle = 0;
    this.dustParticles = [];

    // Load character head image
    this.headImg = new Image();
    this.headLoaded = false;
    this.headImg.onload = () => { this.headLoaded = true; };
    // Prefer local file, fallback to base64 if defined
    if (typeof CHARACTER_HEAD_BASE64 !== 'undefined') {
      this.headImg.src = CHARACTER_HEAD_BASE64;
    } else {
      this.headImg.src = 'character_head.png';
    }

    // Hurt / stars animation angle
    this.dizzyAngle = 0;
  }

  reset() {
    this.y = this.groundY;
    this.vy = 0;
    this.isGrounded = true;
    this.isDucking = false;
    this.isHit = false;
    this.width = this.standWidth;
    this.height = this.standHeight;
    this.runCycle = 0;
    this.dustParticles = [];
    this.dizzyAngle = 0;
  }

  jump() {
    if (this.isGrounded && !this.isHit) {
      this.vy = this.jumpForce;
      this.isGrounded = false;
      this.isDucking = false;
      this.height = this.standHeight;
      this.width = this.standWidth;

      // Spawn jump dust burst
      for (let i = 0; i < 7; i++) {
        this.dustParticles.push(new Particle(
          this.x + 15,
          this.groundY,
          (Math.random() - 0.7) * 3,
          -Math.random() * 2.5,
          Math.random() * 4 + 2,
          'rgba(210, 190, 160, 0.8)',
          20
        ));
      }
      return true;
    }
    return false;
  }

  setDuck(ducking) {
    if (this.isHit) return;
    if (ducking) {
      this.isDucking = true;
      this.height = this.duckHeight;
      this.width = this.duckWidth;
      // Fast drop if in air
      if (!this.isGrounded) {
        this.vy += 3.5;
      }
    } else {
      this.isDucking = false;
      this.height = this.standHeight;
      this.width = this.standWidth;
    }
  }

  update(speed) {
    // Particles update
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      this.dustParticles[i].update();
      if (this.dustParticles[i].life <= 0) {
        this.dustParticles.splice(i, 1);
      }
    }

    if (this.isHit) {
      this.dizzyAngle += 0.08;
      return;
    }

    // Physics
    this.y += this.vy;
    if (!this.isGrounded) {
      this.vy += this.gravity;
      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.vy = 0;
        this.isGrounded = true;
      }
    }

    // Running cycle progression
    if (this.isGrounded) {
      this.runCycle += speed * 0.045;

      // Emit running footsteps dust
      if (Math.random() < 0.28) {
        this.dustParticles.push(new Particle(
          this.x + 5,
          this.groundY - 2,
          -Math.random() * 2 - 1,
          -Math.random() * 1.5,
          Math.random() * 3 + 2,
          'rgba(215, 195, 165, 0.65)',
          16
        ));
      }

      // Extra dust while sliding / ducking
      if (this.isDucking && Math.random() < 0.6) {
        this.dustParticles.push(new Particle(
          this.x + 25,
          this.groundY - 2,
          -Math.random() * 4 - 2,
          -Math.random() * 2,
          Math.random() * 4 + 2,
          'rgba(245, 215, 175, 0.8)',
          18
        ));
      }
    }
  }

  getHitbox() {
    // Fair slightly indented hitbox to make game feel responsive & fair
    const padX = 6;
    const padY = 4;
    return {
      x: this.x + padX,
      y: this.y - this.height + padY,
      width: this.width - padX * 2,
      height: this.height - padY * 2
    };
  }

  draw(ctx) {
    // Draw particles behind runner
    for (const p of this.dustParticles) {
      p.draw(ctx);
    }

    ctx.save();

    // Position origin at feet (x, y)
    ctx.translate(this.x, this.y);

    if (this.isHit) {
      // Tilt back in tumble
      ctx.rotate(-0.35);
      ctx.translate(-10, -5);
    }

    const skinColor = '#8d5538';
    const shirtRed = '#c01d36';
    const shirtShade = '#941427';
    const pantsBlue = '#1e3a8a';
    const pantsDark = '#172554';
    const shoeWhite = '#f8fafc';
    const shoeRed = '#dc2626';

    const bob = (this.isGrounded && !this.isDucking && !this.isHit) ? Math.sin(this.runCycle * 2) * 2.5 : 0;
    const legPhase = this.runCycle;

    if (this.isDucking) {
      // --- DUCKING / SLIDING POSE ---
      // Torso angled low
      ctx.save();
      ctx.translate(14, -24);
      ctx.rotate(0.35);

      // Torso
      ctx.fillStyle = shirtRed;
      ctx.beginPath();
      ctx.roundRect(-10, -18, 38, 22, 6);
      ctx.fill();

      // Shirt logo
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(4, -12, 10, 8);

      // Sliding legs behind
      ctx.restore();

      // Back leg
      ctx.fillStyle = pantsDark;
      ctx.beginPath();
      ctx.roundRect(-16, -16, 32, 11, 4);
      ctx.fill();
      // Back shoe
      ctx.fillStyle = shoeWhite;
      ctx.fillRect(-22, -15, 12, 9);
      ctx.fillStyle = shoeRed;
      ctx.fillRect(-17, -15, 4, 9);

      // Front leg (bent low sliding)
      ctx.fillStyle = pantsBlue;
      ctx.beginPath();
      ctx.roundRect(0, -14, 38, 12, 5);
      ctx.fill();
      // Front shoe
      ctx.fillStyle = shoeWhite;
      ctx.fillRect(36, -14, 15, 11);
      ctx.fillStyle = shoeRed;
      ctx.fillRect(40, -14, 5, 11);

      // Arms sliding forward
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.roundRect(15, -20, 24, 7, 3);
      ctx.fill();

      // Head lowered & forward
      ctx.save();
      ctx.translate(34, -46);
      ctx.rotate(0.15);
      this.drawHead(ctx, 42, 48);
      ctx.restore();

    } else {
      // --- STANDING / RUNNING / JUMPING POSE ---

      // Calculate joint angles for legs
      let leftThighAngle = 0;
      let leftCalfAngle = 0;
      let rightThighAngle = 0;
      let rightCalfAngle = 0;

      if (!this.isGrounded) {
        // Jumping pose (knees tucked, legs trailing)
        leftThighAngle = -0.65;
        leftCalfAngle = 0.95;
        rightThighAngle = 0.45;
        rightCalfAngle = 0.6;
      } else {
        // Running cycle
        leftThighAngle = Math.sin(legPhase) * 0.75;
        leftCalfAngle = Math.max(0, -Math.sin(legPhase) * 0.9);
        rightThighAngle = Math.sin(legPhase + Math.PI) * 0.75;
        rightCalfAngle = Math.max(0, -Math.sin(legPhase + Math.PI) * 0.9);
      }

      const hipX = 18;
      const hipY = -42 + bob;

      // 1. BACK LEG (Rendered behind body)
      this.drawLeg(ctx, hipX, hipY, rightThighAngle, rightCalfAngle, pantsDark, shoeWhite, shoeRed);

      // 2. BACK ARM
      ctx.save();
      ctx.translate(hipX - 2, hipY - 24);
      const backArmAngle = !this.isGrounded ? -0.8 : Math.sin(legPhase + Math.PI) * 0.65;
      ctx.rotate(backArmAngle);
      // Sleeve
      ctx.fillStyle = shirtShade;
      ctx.fillRect(-4, 0, 8, 12);
      // Forearm
      ctx.fillStyle = skinColor;
      ctx.fillRect(-3, 12, 6, 12);
      ctx.restore();

      // 3. TORSO
      ctx.save();
      ctx.translate(hipX, hipY);
      const torsoTilt = !this.isGrounded ? -0.12 : 0.08;
      ctx.rotate(torsoTilt);

      // Red T-Shirt body
      ctx.fillStyle = shirtRed;
      ctx.beginPath();
      ctx.roundRect(-13, -28, 26, 30, 6);
      ctx.fill();

      // Shirt neckline & Silver chain
      ctx.fillStyle = shirtShade;
      ctx.beginPath();
      ctx.arc(0, -26, 7, 0, Math.PI);
      ctx.fill();

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, -25, 6, 0.2, Math.PI - 0.2);
      ctx.stroke();

      // Gold/Yellow Graphic print on chest (matching his real shirt!)
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-6, -18, 13, 9);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-4, -16, 9, 2);

      // Denim Shorts waist
      ctx.fillStyle = pantsBlue;
      ctx.fillRect(-12, 2, 24, 7);
      ctx.restore();

      // 4. FRONT LEG
      this.drawLeg(ctx, hipX, hipY, leftThighAngle, leftCalfAngle, pantsBlue, shoeWhite, shoeRed);

      // 5. FRONT ARM
      ctx.save();
      ctx.translate(hipX + 3, hipY - 23);
      const frontArmAngle = !this.isGrounded ? 0.9 : Math.sin(legPhase) * 0.65;
      ctx.rotate(frontArmAngle);
      // Sleeve
      ctx.fillStyle = shirtRed;
      ctx.fillRect(-4, 0, 9, 13);
      // Arm & Fist
      ctx.fillStyle = skinColor;
      ctx.fillRect(-3, 13, 7, 12);
      ctx.beginPath();
      ctx.arc(0, 25, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 6. HEAD & FACE
      ctx.save();
      const headX = hipX + 1;
      const headY = hipY - 33;
      ctx.translate(headX, headY);

      let headTilt = 0;
      if (this.isHit) {
        headTilt = -0.3;
      } else if (!this.isGrounded) {
        headTilt = 0.15;
      } else {
        headTilt = Math.sin(legPhase * 2) * 0.04;
      }
      ctx.rotate(headTilt);

      this.drawHead(ctx, 46, 52);
      ctx.restore();
    }

    // Dizzy comic stars on game over
    if (this.isHit) {
      this.drawDizzyStars(ctx);
    }

    ctx.restore();
  }

  drawLeg(ctx, hipX, hipY, thighAngle, calfAngle, pantsColor, shoeWhite, shoeRed) {
    ctx.save();
    ctx.translate(hipX, hipY + 5);
    ctx.rotate(thighAngle);

    // Thigh
    ctx.fillStyle = pantsColor;
    ctx.beginPath();
    ctx.roundRect(-5, 0, 10, 18, 4);
    ctx.fill();

    // Knee joint
    ctx.translate(0, 17);
    ctx.rotate(calfAngle);

    // Calf / Shin
    ctx.fillStyle = '#8d5538';
    ctx.fillRect(-4, 0, 8, 16);

    // Sneaker
    ctx.fillStyle = shoeWhite;
    ctx.beginPath();
    ctx.roundRect(-5, 14, 18, 9, 3);
    ctx.fill();

    // Sneaker red accent
    ctx.fillStyle = shoeRed;
    ctx.fillRect(-2, 14, 5, 9);
    // Dark rubber sole
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-5, 21, 18, 3);

    ctx.restore();
  }

  drawHead(ctx, w, h) {
    if (this.headLoaded && this.headImg.complete) {
      // Draw actual cutout photo head with crisp rendering
      ctx.drawImage(this.headImg, -w / 2, -h + 8, w, h);
    } else {
      // Fallback head shape while loading
      ctx.fillStyle = '#8d5538';
      ctx.beginPath();
      ctx.ellipse(0, -h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Hair
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(0, -h * 0.65, w * 0.45, Math.PI, 0);
      ctx.fill();
    }
  }

  drawDizzyStars(ctx) {
    const starCount = 3;
    const radius = 26;
    const centerY = -90;

    for (let i = 0; i < starCount; i++) {
      const angle = this.dizzyAngle + (i * (Math.PI * 2 / starCount));
      const sx = 20 + Math.cos(angle) * radius;
      const sy = centerY + Math.sin(angle) * (radius * 0.4);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(this.dizzyAngle * 2);
      ctx.fillStyle = '#facc15';

      // Draw 5-pointed mini star
      ctx.beginPath();
      for (let s = 0; s < 5; s++) {
        const a1 = s * Math.PI * 0.4;
        const a2 = a1 + Math.PI * 0.2;
        ctx.lineTo(Math.cos(a1) * 6, Math.sin(a1) * 6);
        ctx.lineTo(Math.cos(a2) * 2.5, Math.sin(a2) * 2.5);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Comic "OUCH!" bubble
    ctx.save();
    ctx.translate(50, -110);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(-24, -14, 48, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OUCH!', 0, -2);
    ctx.restore();
  }
}

// --- OBSTACLE CLASSES ---
class Obstacle {
  constructor(x, groundY, type) {
    this.x = x;
    this.groundY = groundY;
    this.type = type; // 'cactus_s', 'cactus_d', 'cactus_t', 'bird_low', 'bird_high'
    this.passed = false;

    if (type === 'cactus_s') {
      this.width = 24;
      this.height = 48;
      this.y = groundY - this.height;
    } else if (type === 'cactus_d') {
      this.width = 46;
      this.height = 54;
      this.y = groundY - this.height;
    } else if (type === 'cactus_t') {
      this.width = 68;
      this.height = 56;
      this.y = groundY - this.height;
    } else if (type === 'bird_low') {
      this.width = 44;
      this.height = 32;
      this.y = groundY - 48; // Must duck or jump
      this.wingFrame = 0;
    } else if (type === 'bird_high') {
      this.width = 44;
      this.height = 32;
      this.y = groundY - 80; // Must duck under
      this.wingFrame = 0;
    }
  }

  update(speed) {
    this.x -= speed;
    if (this.type.startsWith('bird')) {
      this.wingFrame += 0.18;
    }
  }

  getHitbox() {
    // Tight fair collision bounding box
    const pad = 4;
    return {
      x: this.x + pad,
      y: this.y + pad,
      width: this.width - pad * 2,
      height: this.height - pad * 2
    };
  }

  draw(ctx, isNight) {
    ctx.save();
    if (this.type.startsWith('cactus')) {
      this.drawCactus(ctx, isNight);
    } else {
      this.drawBird(ctx, isNight);
    }
    ctx.restore();
  }

  drawCactus(ctx, isNight) {
    const mainColor = isNight ? '#22c55e' : '#15803d';
    const darkColor = isNight ? '#16a34a' : '#166534';
    const ribColor = isNight ? '#4ade80' : '#22c55e';

    const drawSingleStem = (cx, cy, cw, ch) => {
      // Main stem
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.roundRect(cx, cy, cw, ch, cw / 2);
      ctx.fill();

      // Shadow side
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.roundRect(cx + cw * 0.55, cy, cw * 0.45, ch, [0, cw / 2, cw / 2, 0]);
      ctx.fill();

      // Vertical ribs
      ctx.strokeStyle = ribColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + cw * 0.3, cy + 4);
      ctx.lineTo(cx + cw * 0.3, cy + ch - 4);
      ctx.stroke();

      // Small arms
      ctx.fillStyle = mainColor;
      // Left arm
      ctx.fillRect(cx - 5, cy + ch * 0.35, 6, 4);
      ctx.fillRect(cx - 7, cy + ch * 0.2, 5, 10);
      // Right arm
      ctx.fillRect(cx + cw - 1, cy + ch * 0.45, 6, 4);
      ctx.fillRect(cx + cw + 2, cy + ch * 0.3, 5, 10);
    };

    if (this.type === 'cactus_s') {
      drawSingleStem(this.x + 3, this.y, 18, this.height);
    } else if (this.type === 'cactus_d') {
      drawSingleStem(this.x + 2, this.y + 8, 16, this.height - 8);
      drawSingleStem(this.x + 22, this.y, 20, this.height);
    } else if (this.type === 'cactus_t') {
      drawSingleStem(this.x + 2, this.y + 12, 16, this.height - 12);
      drawSingleStem(this.x + 22, this.y, 20, this.height);
      drawSingleStem(this.x + 46, this.y + 6, 17, this.height - 6);
    }
  }

  drawBird(ctx, isNight) {
    const bodyColor = isNight ? '#cbd5e1' : '#334155';
    const wingColor = isNight ? '#e2e8f0' : '#475569';
    const eyeColor = '#ef4444';

    ctx.save();
    ctx.translate(this.x, this.y);

    const flap = Math.sin(this.wingFrame); // -1 to 1

    // Body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(22, 16, 16, 8, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Head & Beak
    ctx.beginPath();
    ctx.arc(8, 12, 6, 0, Math.PI * 2);
    ctx.fill();
    // Beak
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(3, 10);
    ctx.lineTo(-6, 14);
    ctx.lineTo(3, 16);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(7, 11, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Wings (Flapping dynamically)
    ctx.fillStyle = wingColor;
    ctx.beginPath();
    if (flap > 0) {
      // Wings UP
      ctx.moveTo(18, 14);
      ctx.lineTo(28, -2 - flap * 6);
      ctx.lineTo(34, 12);
    } else {
      // Wings DOWN
      ctx.moveTo(18, 16);
      ctx.lineTo(28, 28 - flap * 4);
      ctx.lineTo(34, 16);
    }
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

// --- PARALLAX BACKGROUND & ENVIRONMENT ---
class Environment {
  constructor(width, height, groundY) {
    this.width = width;
    this.height = height;
    this.groundY = groundY;

    // Day / Night state
    this.dayNightCycle = 0; // 0: day, 1: sunset, 2: night, 3: sunrise

    // Clouds
    this.clouds = [
      { x: 100, y: 50, scale: 1.0, speed: 0.35 },
      { x: 380, y: 80, scale: 0.8, speed: 0.25 },
      { x: 650, y: 40, scale: 1.2, speed: 0.4 },
      { x: 920, y: 70, scale: 0.9, speed: 0.3 }
    ];

    // Distant mountain dunes
    this.mountainsX = 0;

    // Ground bumps & pebbles
    this.groundOffset = 0;
    this.pebbles = [];
    for (let x = 0; x < width * 2; x += 32) {
      this.pebbles.push({
        x: x + Math.random() * 20,
        y: groundY + 8 + Math.random() * 18,
        size: Math.random() * 3 + 1,
        color: 'rgba(180, 160, 130, 0.5)'
      });
    }

    // Stars for night
    this.stars = [];
    for (let i = 0; i < 45; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * (groundY - 90),
        size: Math.random() * 2 + 0.5,
        twinkle: Math.random() * Math.PI * 2
      });
    }
  }

  update(speed, score) {
    // Progress day/night cycle based on score
    // 0 -> 400 Day, 400 -> 550 Sunset, 550 -> 900 Night, 900 -> 1000 Sunrise
    const cyclePos = score % 1000;
    if (cyclePos < 450) {
      this.dayPhase = 'day';
      this.nightAlpha = 0;
    } else if (cyclePos < 550) {
      this.dayPhase = 'sunset';
      this.nightAlpha = (cyclePos - 450) / 100;
    } else if (cyclePos < 900) {
      this.dayPhase = 'night';
      this.nightAlpha = 1;
    } else {
      this.dayPhase = 'sunrise';
      this.nightAlpha = 1 - (cyclePos - 900) / 100;
    }

    // Clouds
    for (const c of this.clouds) {
      c.x -= c.speed;
      if (c.x < -120) {
        c.x = this.width + Math.random() * 80;
        c.y = 35 + Math.random() * 70;
      }
    }

    // Mountain dunes
    this.mountainsX = (this.mountainsX - speed * 0.15) % 400;

    // Ground
    this.groundOffset = (this.groundOffset - speed) % 60;
    for (const p of this.pebbles) {
      p.x -= speed;
      if (p.x < -20) {
        p.x += this.width + 50;
      }
    }

    // Stars twinkle
    for (const s of this.stars) {
      s.twinkle += 0.05;
    }
  }

  draw(ctx) {
    // 1. SKY GRADIENT
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.groundY);
    if (this.nightAlpha > 0) {
      // Night sky
      skyGrad.addColorStop(0, '#090d16');
      skyGrad.addColorStop(0.7, '#111827');
      skyGrad.addColorStop(1, '#1e293b');
    } else {
      // Crisp daylight sky
      skyGrad.addColorStop(0, '#f8fafc');
      skyGrad.addColorStop(0.65, '#f1f5f9');
      skyGrad.addColorStop(1, '#e2e8f0');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. STARS (during night phase)
    if (this.nightAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = this.nightAlpha;
      for (const s of this.stars) {
        const starBrightness = 0.4 + 0.6 * Math.sin(s.twinkle);
        ctx.fillStyle = `rgba(255, 255, 255, ${starBrightness})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      // Glowing Moon
      ctx.fillStyle = '#f8fafc';
      ctx.shadowColor = '#e2e8f0';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(780, 65, 24, 0, Math.PI * 2);
      ctx.fill();
      // Moon craters
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(774, 60, 4, 0, Math.PI * 2);
      ctx.arc(788, 72, 5, 0, Math.PI * 2);
      ctx.arc(784, 56, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // Sun
      ctx.save();
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = 'rgba(251, 191, 36, 0.4)';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(780, 65, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. PARALLAX MOUNTAINS / DUNES
    ctx.save();
    ctx.fillStyle = this.nightAlpha > 0 ? '#1f2937' : '#cbd5e1';
    for (let x = this.mountainsX - 400; x < this.width + 400; x += 220) {
      ctx.beginPath();
      ctx.moveTo(x, this.groundY);
      ctx.quadraticCurveTo(x + 110, this.groundY - 55, x + 220, this.groundY);
      ctx.fill();
    }
    ctx.restore();

    // 4. CLOUDS
    for (const c of this.clouds) {
      this.drawCloud(ctx, c.x, c.y, c.scale, this.nightAlpha > 0);
    }

    // 5. GROUND LINE & TEXTURE
    ctx.save();
    // Ground base line
    ctx.strokeStyle = this.nightAlpha > 0 ? '#475569' : '#64748b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    ctx.lineTo(this.width, this.groundY);
    ctx.stroke();

    // Ground bumps pattern
    ctx.strokeStyle = this.nightAlpha > 0 ? '#334155' : '#94a3b8';
    ctx.lineWidth = 1.8;
    for (let x = this.groundOffset; x < this.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, this.groundY + 1);
      ctx.lineTo(x + 16, this.groundY + 1);
      ctx.stroke();
    }

    // Pebbles
    for (const p of this.pebbles) {
      ctx.fillStyle = this.nightAlpha > 0 ? 'rgba(100, 116, 139, 0.5)' : p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawCloud(ctx, x, y, scale, isNight) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = isNight ? 'rgba(51, 65, 85, 0.6)' : 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(20, 20, 16, 0, Math.PI * 2);
    ctx.arc(40, 16, 20, 0, Math.PI * 2);
    ctx.arc(62, 20, 15, 0, Math.PI * 2);
    ctx.arc(50, 26, 14, 0, Math.PI * 2);
    ctx.arc(28, 26, 14, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// --- MAIN GAME MANAGER ---
class GameManager {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Fixed logical internal resolution for consistent physics
    this.width = 900;
    this.height = 360;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.groundY = 300;

    this.sound = new SoundSystem();
    this.runner = new Runner(this.groundY);
    this.env = new Environment(this.width, this.height, this.groundY);

    this.obstacles = [];
    this.obstacleTimer = 0;
    this.minObstacleDistance = 240;

    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('kpr_runner_hi') || '0', 10);
    this.lastMilestone = 0;
    this.milestoneFlashTimer = 0;

    this.baseSpeed = 6.8;
    this.speed = this.baseSpeed;

    this.state = 'START'; // 'START', 'PLAYING', 'PAUSED', 'GAMEOVER'

    // Cache UI elements
    this.scoreEl = document.getElementById('currentScore');
    this.hiScoreEl = document.getElementById('hiScore');
    this.startOverlay = document.getElementById('startOverlay');
    this.gameOverOverlay = document.getElementById('gameOverOverlay');
    this.pauseOverlay = document.getElementById('pauseOverlay');
    this.muteBtn = document.getElementById('muteBtn');
    this.finalScoreEl = document.getElementById('finalScore');
    this.bestScoreEl = document.getElementById('bestScore');

    this.updateHiScoreDisplay();
    this.updateMuteButtonUI();
    this.bindInputs();

    // Start render loop
    requestAnimationFrame((ts) => this.loop(ts));
  }

  updateHiScoreDisplay() {
    const formattedHi = String(this.highScore).padStart(5, '0');
    this.hiScoreEl.textContent = `HI ${formattedHi}`;
    if (this.bestScoreEl) {
      this.bestScoreEl.textContent = formattedHi;
    }
  }

  updateMuteButtonUI() {
    if (this.muteBtn) {
      this.muteBtn.innerHTML = this.sound.muted ? '🔇 Muted' : '🔊 Sound';
    }
  }

  bindInputs() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      // Space or ArrowUp to jump / start
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        this.sound.init();
        if (this.state === 'START' || this.state === 'GAMEOVER') {
          this.startGame();
        } else if (this.state === 'PLAYING') {
          if (this.runner.jump()) {
            this.sound.playJump();
          }
        }
      }
      // ArrowDown to duck
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        this.sound.init();
        if (this.state === 'PLAYING' && !this.runner.isDucking) {
          this.runner.setDuck(true);
          this.sound.playDuck();
        }
      }
      // P to pause
      else if (e.code === 'KeyP') {
        this.togglePause();
      }
      // R to restart
      else if (e.code === 'KeyR' && this.state === 'GAMEOVER') {
        this.startGame();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        if (this.state === 'PLAYING') {
          this.runner.setDuck(false);
        }
      }
    });

    // Mobile / Touch controls
    const jumpBtn = document.getElementById('jumpBtn');
    const duckBtn = document.getElementById('duckBtn');
    const restartBtn = document.getElementById('restartBtn');
    const startPlayBtn = document.getElementById('startPlayBtn');

    if (startPlayBtn) {
      startPlayBtn.addEventListener('click', () => {
        this.sound.init();
        this.startGame();
      });
    }

    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        this.sound.init();
        this.startGame();
      });
    }

    if (jumpBtn) {
      jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.sound.init();
        if (this.state === 'START' || this.state === 'GAMEOVER') {
          this.startGame();
        } else if (this.state === 'PLAYING') {
          if (this.runner.jump()) this.sound.playJump();
        }
      });
      jumpBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.sound.init();
        if (this.state === 'START' || this.state === 'GAMEOVER') {
          this.startGame();
        } else if (this.state === 'PLAYING') {
          if (this.runner.jump()) this.sound.playJump();
        }
      });
    }

    if (duckBtn) {
      const handleDuckStart = (e) => {
        e.preventDefault();
        this.sound.init();
        if (this.state === 'PLAYING') {
          this.runner.setDuck(true);
          this.sound.playDuck();
        }
      };
      const handleDuckEnd = (e) => {
        e.preventDefault();
        if (this.state === 'PLAYING') {
          this.runner.setDuck(false);
        }
      };

      duckBtn.addEventListener('touchstart', handleDuckStart);
      duckBtn.addEventListener('touchend', handleDuckEnd);
      duckBtn.addEventListener('mousedown', handleDuckStart);
      duckBtn.addEventListener('mouseup', handleDuckEnd);
    }

    // Canvas click to jump / start
    this.canvas.addEventListener('pointerdown', (e) => {
      this.sound.init();
      if (this.state === 'START' || this.state === 'GAMEOVER') {
        this.startGame();
      } else if (this.state === 'PLAYING') {
        if (this.runner.jump()) {
          this.sound.playJump();
        }
      }
    });

    // Mute toggle
    if (this.muteBtn) {
      this.muteBtn.addEventListener('click', () => {
        this.sound.toggleMute();
        this.updateMuteButtonUI();
      });
    }

    // Pause toggle
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.togglePause());
    }
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      if (this.pauseOverlay) this.pauseOverlay.classList.remove('hidden');
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      if (this.pauseOverlay) this.pauseOverlay.classList.add('hidden');
    }
  }

  startGame() {
    this.state = 'PLAYING';
    this.score = 0;
    this.speed = this.baseSpeed;
    this.lastMilestone = 0;
    this.milestoneFlashTimer = 0;
    this.obstacles = [];
    this.obstacleTimer = 70;
    this.runner.reset();

    if (this.startOverlay) this.startOverlay.classList.add('hidden');
    if (this.gameOverOverlay) this.gameOverOverlay.classList.add('hidden');
    if (this.pauseOverlay) this.pauseOverlay.classList.add('hidden');
    if (this.scoreEl) this.scoreEl.classList.remove('milestone-flash');
  }

  gameOver() {
    this.state = 'GAMEOVER';
    this.runner.isHit = true;
    this.sound.playHit();

    // Check High Score
    if (this.score > this.highScore) {
      this.highScore = Math.floor(this.score);
      localStorage.setItem('kpr_runner_hi', this.highScore);
      this.updateHiScoreDisplay();
    }

    // Update overlay stats
    const formattedScore = String(Math.floor(this.score)).padStart(5, '0');
    if (this.finalScoreEl) this.finalScoreEl.textContent = formattedScore;
    if (this.bestScoreEl) this.bestScoreEl.textContent = String(this.highScore).padStart(5, '0');

    setTimeout(() => {
      if (this.gameOverOverlay) this.gameOverOverlay.classList.remove('hidden');
    }, 450);
  }

  spawnObstacle() {
    const r = Math.random();
    let type = 'cactus_s';

    // As score increases, introduce birds & multiple cacti
    if (this.score > 250 && r > 0.65) {
      // Birds spawn at 2 heights
      type = Math.random() < 0.5 ? 'bird_low' : 'bird_high';
    } else if (r > 0.68) {
      type = 'cactus_t';
    } else if (r > 0.35) {
      type = 'cactus_d';
    } else {
      type = 'cactus_s';
    }

    this.obstacles.push(new Obstacle(this.width + 40, this.groundY, type));

    // Dynamic delay before next spawn ensuring jumpability
    const speedFactor = 1000 / this.speed;
    this.obstacleTimer = speedFactor * (0.85 + Math.random() * 0.9);
  }

  checkCollision(boxA, boxB) {
    return (
      boxA.x < boxB.x + boxB.width &&
      boxA.x + boxA.width > boxB.x &&
      boxA.y < boxB.y + boxB.height &&
      boxA.y + boxA.height > boxB.y
    );
  }

  update() {
    if (this.state !== 'PLAYING') {
      if (this.state === 'GAMEOVER') {
        this.runner.update(0);
      }
      return;
    }

    // Score & speed increase
    this.score += 0.16;
    this.speed = this.baseSpeed + Math.min(Math.floor(this.score / 100) * 0.55, 7.5);

    // Milestone sound (every 100 points)
    const current100 = Math.floor(this.score / 100);
    if (current100 > this.lastMilestone && current100 > 0) {
      this.lastMilestone = current100;
      this.sound.playMilestone();
      this.milestoneFlashTimer = 60; // flash score for ~1 sec
      if (this.scoreEl) this.scoreEl.classList.add('milestone-flash');
    }

    if (this.milestoneFlashTimer > 0) {
      this.milestoneFlashTimer--;
      if (this.milestoneFlashTimer <= 0 && this.scoreEl) {
        this.scoreEl.classList.remove('milestone-flash');
      }
    }

    // UI Score display
    if (this.scoreEl) {
      this.scoreEl.textContent = String(Math.floor(this.score)).padStart(5, '0');
    }

    // Update runner & environment
    this.runner.update(this.speed);
    this.env.update(this.speed, Math.floor(this.score));

    // Spawn obstacles
    this.obstacleTimer--;
    if (this.obstacleTimer <= 0) {
      this.spawnObstacle();
    }

    // Update obstacles & check collision
    const runnerBox = this.runner.getHitbox();

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.update(this.speed);

      // Check collision
      if (this.checkCollision(runnerBox, obs.getHitbox())) {
        this.gameOver();
        break;
      }

      // Remove off-screen obstacles
      if (obs.x < -80) {
        this.obstacles.splice(i, 1);
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw Environment (Sky, sun/moon, mountains, ground)
    this.env.draw(this.ctx);

    // 2. Draw Obstacles
    const isNight = this.env.nightAlpha > 0.4;
    for (const obs of this.obstacles) {
      obs.draw(this.ctx, isNight);
    }

    // 3. Draw Runner
    this.runner.draw(this.ctx);
  }

  loop(timestamp) {
    this.update();
    this.draw();
    requestAnimationFrame((ts) => this.loop(ts));
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.kprGame = new GameManager();
});
