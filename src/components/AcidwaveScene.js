/**
 * Acidwave 3D Background Engine using Three.js
 * Generates iridescent, organic chrome undulating rib waves matching the user reference
 */

import * as THREE from 'three';

export class AcidwaveScene {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId);
    if (!this.container) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.mesh = null;
    this.material = null;
    this.animationFrameId = null;
    this.clock = new THREE.Clock();
    this.currentTheme = 0;

    // Acidwave Color Palettes (Top/Mid/Base highlights)
    this.palettes = [
      // 0: Classic Cyber Acidwave (Electric Blue, Neon Magenta, Toxic Green, Hot Pink)
      {
        colorA: new THREE.Color(0x0044ff), // Blue
        colorB: new THREE.Color(0xff0066), // Pink/Magenta
        colorC: new THREE.Color(0x00ff88), // Neon Green
        colorD: new THREE.Color(0xff4500)  // Acid Orange
      },
      // 1: Ultraviolet Sunset (Purple, Hot Violet, Cyan, Electric Tangerine)
      {
        colorA: new THREE.Color(0x7928ca),
        colorB: new THREE.Color(0xff0080),
        colorC: new THREE.Color(0x00dfd8),
        colorD: new THREE.Color(0xff9900)
      },
      // 2: Toxic Chrome (Emerald, Lime, Indigo, Hyper Pink)
      {
        colorA: new THREE.Color(0x00ff88),
        colorB: new THREE.Color(0x110066),
        colorC: new THREE.Color(0xff0055),
        colorD: new THREE.Color(0x00e5ff)
      },
      // 3: Solar Flare (Deep Crimson, Neon Amber, Solar Yellow, Magenta)
      {
        colorA: new THREE.Color(0xff0044),
        colorB: new THREE.Color(0xff7700),
        colorC: new THREE.Color(0xffea00),
        colorD: new THREE.Color(0x9d00ff)
      },
      // 4: Liquid Aurora (Teal, Hyper Blue, Electric Coral, Neon Violet)
      {
        colorA: new THREE.Color(0x00f5d4),
        colorB: new THREE.Color(0x7b2cbf),
        colorC: new THREE.Color(0xff5400),
        colorD: new THREE.Color(0x3a86ff)
      },
      // 5: Iridescent Silver Chrome
      {
        colorA: new THREE.Color(0x38bdf8),
        colorB: new THREE.Color(0xf43f5e),
        colorC: new THREE.Color(0x10b981),
        colorD: new THREE.Color(0xffffff)
      }
    ];

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 400;
    const height = this.container.clientHeight || 700;

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    this.camera.position.set(0, -0.2, 2.3);

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Custom Shader Material for 3D Ribbed Undulating Acid Wave
    const palette = this.palettes[0];
    this.uniforms = {
      uTime: { value: 0 },
      uSpeed: { value: 0.85 },
      uColorA: { value: palette.colorA },
      uColorB: { value: palette.colorB },
      uColorC: { value: palette.colorC },
      uColorD: { value: palette.colorD },
      uFrequency: { value: 4.8 },
      uRibCount: { value: 38.0 },
      uDistortion: { value: 0.42 }
    };

    const vertexShader = `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform float uTime;
      uniform float uSpeed;
      uniform float uDistortion;

      void main() {
        vUv = uv;
        vec3 pos = position;

        float t = uTime * uSpeed;
        
        // Fluid undulating peaks and ridges
        float wave1 = sin(pos.x * 2.8 + t * 0.9) * cos(pos.y * 3.2 + t * 0.7);
        float wave2 = cos(pos.x * 4.5 - t * 0.6 + sin(pos.y * 2.2)) * 0.35;
        float wave3 = sin((pos.x + pos.y) * 3.5 + t * 0.8) * 0.25;

        // Apply progressive height deformation
        pos.z += (wave1 + wave2 + wave3) * uDistortion;
        
        // Slanted rib angle
        pos.z += sin(pos.x * 12.0 + wave1 * 2.0) * 0.08;

        vNormal = normalize(normalMatrix * normal);
        vPosition = pos;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;

    const fragmentShader = `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform float uTime;
      uniform float uRibCount;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uColorC;
      uniform vec3 uColorD;

      void main() {
        float t = uTime * 0.5;

        // Repetitive vertical/curved 3D pleat ribs
        float rib = sin((vUv.x * 1.2 + vPosition.z * 0.6) * uRibCount);
        float ribHighlight = smoothstep(-0.2, 0.8, rib);
        float ribShadow = smoothstep(0.4, -0.6, rib) * 0.35;

        // Dynamic fluid blend between palettes
        float blend1 = sin(vUv.y * 3.5 + t + vPosition.z * 2.0) * 0.5 + 0.5;
        float blend2 = cos(vUv.x * 3.0 - t * 0.8) * 0.5 + 0.5;

        vec3 col = mix(uColorA, uColorB, blend1);
        col = mix(col, uColorC, blend2 * 0.7);
        col = mix(col, uColorD, sin(vPosition.z * 4.0 + t) * 0.5 + 0.5);

        // Specular chrome shine on the peaks of the ribs
        vec3 lightDir = normalize(vec3(0.5, 0.8, 1.2));
        float diff = max(dot(vNormal, lightDir), 0.0);
        float spec = pow(max(dot(reflect(-lightDir, vNormal), vec3(0.0, 0.0, 1.0)), 0.0), 32.0);

        // Chrome gloss & iridescent edge tint
        col = col * (0.65 + 0.55 * ribHighlight) - ribShadow;
        col += spec * 0.75;
        col += pow(1.0 - abs(vNormal.z), 3.0) * uColorA * 0.5; // Rim Fresnel glow

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      wireframe: false,
      side: THREE.DoubleSide
    });

    // High resolution undulating plane
    const geometry = new THREE.PlaneGeometry(3.6, 5.0, 140, 140);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.rotation.x = -0.35;
    this.mesh.rotation.z = -0.08;
    this.scene.add(this.mesh);

    // Handle Resize
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);

    this.animate();
  }

  setTheme(slideIndex) {
    const palette = this.palettes[slideIndex % this.palettes.length];
    if (!palette || !this.uniforms) return;

    this.uniforms.uColorA.value = palette.colorA;
    this.uniforms.uColorB.value = palette.colorB;
    this.uniforms.uColorC.value = palette.colorC;
    this.uniforms.uColorD.value = palette.colorD;

    // Subtle wave speed & rib variation per slide
    this.uniforms.uSpeed.value = 0.75 + (slideIndex % 3) * 0.25;
    this.uniforms.uRibCount.value = 34.0 + (slideIndex % 4) * 5.0;
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    this.uniforms.uTime.value += delta;

    // Gentle camera sway
    const t = this.uniforms.uTime.value;
    this.mesh.rotation.y = Math.sin(t * 0.3) * 0.05;

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    if (this.material) this.material.dispose();
  }
}
