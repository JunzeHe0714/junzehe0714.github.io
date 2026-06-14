import * as THREE from "../vendor/three.module.js";

    const supportsWebGL = (() => {
      try {
        const test = document.createElement("canvas");
        return Boolean(window.WebGLRenderingContext && (test.getContext("webgl") || test.getContext("experimental-webgl")));
      } catch {
        return false;
      }
    })();

    if (!supportsWebGL) {
      document.body.classList.add("webgl-fallback");
    }

    const smoothContent = document.querySelector("#smooth-content");
    const smooth = {
      enabled: false,
      current: window.scrollY,
      target: window.scrollY
    };

    function shouldUseSmoothScroll() {
      return window.matchMedia("(min-width: 781px) and (prefers-reduced-motion: no-preference)").matches;
    }

    function measureSmoothContent() {
      if (!smoothContent) return;
      const height = smoothContent.scrollHeight;
      document.body.style.setProperty("--smooth-height", `${height}px`);
    }

    function configureSmoothScroll() {
      smooth.enabled = shouldUseSmoothScroll();
      smooth.current = window.scrollY;
      smooth.target = window.scrollY;
      document.body.classList.toggle("smooth-ready", smooth.enabled);
      document.documentElement.style.setProperty("--smooth-y", smooth.enabled ? `${smooth.current}px` : "0px");
      measureSmoothContent();
    }

    function updateSmoothScroll() {
      smooth.target = window.scrollY;
      if (smooth.enabled) {
        smooth.current += (smooth.target - smooth.current) * 0.105;
        if (Math.abs(smooth.target - smooth.current) < 0.08) smooth.current = smooth.target;
        document.documentElement.style.setProperty("--smooth-y", `${smooth.current}px`);
      } else {
        smooth.current = smooth.target;
        document.documentElement.style.setProperty("--smooth-y", "0px");
      }
      return smooth.current;
    }

    function clamp01(value) {
      return Math.min(Math.max(value, 0), 1);
    }

    function updateRevealMotion(scrollY) {
      for (const element of document.querySelectorAll(".reveal")) {
        const start = element.offsetTop - window.innerHeight * 0.84;
        const end = element.offsetTop - window.innerHeight * 0.38;
        const progress = clamp01((scrollY - start) / Math.max(end - start, 1));
        const eased = 1 - Math.pow(1 - progress, 3);
        element.style.setProperty("--reveal-progress", eased.toFixed(4));
      }
    }

    if (supportsWebGL) {
    const canvas = document.querySelector("#fluid-canvas");
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    const mobileFluidQuery = window.matchMedia("(max-width: 780px), (pointer: coarse)");

    function fluidSettings() {
      if (mobileFluidQuery.matches) {
        return {
          pixelRatio: 1.18,
          pointerEase: 0.065,
          scrollEase: 0.078,
          scrollScale: 2.55
        };
      }
      return {
        pixelRatio: 1.65,
        pointerEase: 0.04,
        scrollEase: 0.055,
        scrollScale: 3.2
      };
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, fluidSettings().pixelRatio));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      uScroll: { value: 0 },
      uMobile: { value: 0 }
    };

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform vec2 uResolution;
        uniform vec2 uPointer;
        uniform float uTime;
        uniform float uScroll;
        uniform float uMobile;

        mat2 rot(float a) {
          float s = sin(a);
          float c = cos(a);
          return mat2(c, -s, s, c);
        }

        float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
          vec2 pa = p - a;
          vec2 ba = b - a;
          float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
          return length(pa - ba * h) - r;
        }

        float softBand(vec2 p, vec2 a, vec2 b, float r, float blur) {
          return 1.0 - smoothstep(r, r + blur, sdCapsule(p, a, b, r));
        }

        float blob(vec2 p, vec2 c, float r, float blur) {
          return 1.0 - smoothstep(r, r + blur, length(p - c));
        }

        void main() {
          vec2 uv = vUv;
          vec2 p = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
          vec2 pointer = (uPointer - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
          p.x *= mix(1.0, 0.78, uMobile);
          pointer *= mix(1.0, 0.38, uMobile);

          float s = smoothstep(0.0, 1.0, fract(uScroll * mix(0.42, 0.34, uMobile)));
          float depth = smoothstep(0.0, 1.0, min(uScroll, 1.0));
          float t = uTime * mix(0.28, 0.22, uMobile);
          vec2 slide = vec2(mix(-0.22, 0.22, s), mix(0.10, -0.15, s));
          slide = mix(slide, vec2(mix(-0.08, 0.08, s), mix(0.22, -0.26, s)), uMobile);

          vec2 a1 = rot(0.18 + s * 0.75) * vec2(-0.92, 0.22) + slide + pointer * 0.040;
          vec2 b1 = rot(0.18 + s * 0.75) * vec2(0.58, -0.06) + slide + vec2(sin(t) * 0.035, cos(t) * 0.025);
          vec2 a2 = rot(-0.56 + s * 1.05) * vec2(-0.42, -0.44) - slide * 0.72;
          vec2 b2 = rot(-0.56 + s * 1.05) * vec2(0.92, 0.34) - slide * 0.72 + pointer * 0.028;

          float ribbonA = softBand(p, a1, b1, mix(0.072 + 0.022 * sin(s * 3.1415), 0.116, uMobile), mix(0.17, 0.24, uMobile));
          float ribbonB = softBand(p, a2, b2, mix(0.060, 0.096, uMobile), mix(0.15, 0.22, uMobile));
          float sphereA = blob(p, vec2(-0.62 + s * 0.42, 0.36 - s * 0.18) + pointer * 0.04, mix(0.19, 0.28, uMobile), mix(0.24, 0.34, uMobile));
          float sphereB = blob(p, vec2(0.72 - s * 0.55, -0.36 + s * 0.16), mix(0.24, 0.31, uMobile), mix(0.28, 0.36, uMobile));

          float field = ribbonA * 0.72 + ribbonB * 0.58 + sphereA * 0.72 + sphereB * 0.58;
          float edge = smoothstep(0.18, 0.52, field) - smoothstep(0.58, 0.86, field);
          float body = smoothstep(0.10, 0.72, field);
          float light = smoothstep(0.0, 1.0, 1.0 - length(p - vec2(-0.24, 0.24)));

          vec3 teal = vec3(0.18, 0.48, 0.43);
          vec3 sage = vec3(0.58, 0.68, 0.62);
          vec3 warm = vec3(0.66, 0.45, 0.28);
          vec3 color = mix(teal, warm, clamp(uv.x + s * 0.22, 0.0, 1.0));
          color = mix(color, sage, 0.22 + 0.18 * sin(t + uv.y * 3.0));
          color += light * 0.10;

          float grain = sin((uv.x * 109.0 + uv.y * 71.0) + uTime * 0.55) * 0.006;
          float alpha = body * 0.17 + edge * 0.10 + grain;
          alpha *= mix(1.0, mix(0.46, 0.68, uMobile), depth);
          alpha *= mix(1.0, 0.88 + 0.10 * sin(t + uv.y * 2.4), uMobile);

          gl_FragColor = vec4(color, clamp(alpha, 0.0, mix(0.30, 0.27, uMobile)));
        }
      `
    });

    scene.add(new THREE.Mesh(geometry, material));

    const pointer = { x: 0.5, y: 0.52 };
    const eased = { x: pointer.x, y: pointer.y };
    let scrollTarget = 0;
    let scrollValue = 0;

    function resize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const settings = fluidSettings();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatio));
      renderer.setSize(width, height, false);
      uniforms.uResolution.value.set(width, height);
      uniforms.uMobile.value = mobileFluidQuery.matches ? 1 : 0;
    }

    function updateScroll(scrollY = smooth.current) {
      const hero = document.querySelector(".hero-wrap");
      const max = Math.max(hero.offsetHeight - window.innerHeight, 1);
      const heroProgress = Math.min(Math.max(scrollY / max, 0), 1);
      const pageMax = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      scrollTarget = Math.max(scrollY / pageMax, 0) * fluidSettings().scrollScale;
      document.documentElement.style.setProperty("--hero-progress", heroProgress.toFixed(4));
    }

    function updatePointer(event) {
      if (event.pointerType === "touch") return;
      pointer.x = event.clientX / window.innerWidth;
      pointer.y = 1 - event.clientY / window.innerHeight;
      document.documentElement.style.setProperty("--mx", `${(pointer.x - 0.5) * 28}px`);
      document.documentElement.style.setProperty("--my", `${(0.5 - pointer.y) * 22}px`);
      document.documentElement.style.setProperty("--pointer-x", `${(pointer.x - 0.5).toFixed(4)}`);
      document.documentElement.style.setProperty("--pointer-y", `${(pointer.y - 0.5).toFixed(4)}`);
    }

    function animate(time) {
      const visualScroll = updateSmoothScroll();
      updateScroll(visualScroll);
      updateRevealMotion(visualScroll);
      updateActiveNav(visualScroll);
      const settings = fluidSettings();
      eased.x += (pointer.x - eased.x) * settings.pointerEase;
      eased.y += (pointer.y - eased.y) * settings.pointerEase;
      scrollValue += (scrollTarget - scrollValue) * settings.scrollEase;
      uniforms.uTime.value = time * 0.001;
      uniforms.uPointer.value.set(eased.x, eased.y);
      uniforms.uScroll.value = scrollValue;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    window.addEventListener("resize", () => { resize(); configureSmoothScroll(); updateScroll(smooth.current); }, { passive: true });
    window.addEventListener("pointermove", updatePointer, { passive: true });

    configureSmoothScroll();
    resize();
    updateScroll(smooth.current);
    updateRevealMotion(smooth.current);
    requestAnimationFrame(animate);
    }

    const navLinks = [...document.querySelectorAll("nav a[href^='#']")];
    const sections = navLinks
      .map((link) => document.querySelector(link.getAttribute("href")))
      .filter(Boolean);

    function updateActiveNav(scrollY = smooth.current) {
      const y = scrollY + window.innerHeight * 0.58;
      let active = sections[0]?.id;
      for (const section of sections) {
        if (section.offsetTop <= y) active = section.id;
      }
      for (const link of navLinks) {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${active}`);
      }
    }

    for (const link of navLinks) {
      link.addEventListener("click", (event) => {
        const target = document.querySelector(link.getAttribute("href"));
        if (!target) return;
        event.preventDefault();
        window.scrollTo({ top: target.offsetTop, behavior: "smooth" });
      });
    }

    if (!supportsWebGL) {
      configureSmoothScroll();
      updateRevealMotion(smooth.current);
      updateActiveNav(smooth.current);
      window.addEventListener("scroll", () => {
        const visualScroll = updateSmoothScroll();
        updateRevealMotion(visualScroll);
        updateActiveNav(visualScroll);
      }, { passive: true });
      window.addEventListener("resize", () => {
        configureSmoothScroll();
        updateRevealMotion(smooth.current);
        updateActiveNav(smooth.current);
      }, { passive: true });
    }
