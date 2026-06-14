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
      document.body.style.setProperty("--smooth-height", `${smoothContent.scrollHeight}px`);
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

    if (supportsWebGL) {
      const canvas = document.querySelector("#fluid-canvas");
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
      const mobileQuery = window.matchMedia("(max-width: 780px), (pointer: coarse)");

      function settings() {
        if (mobileQuery.matches) {
          return { pixelRatio: 1.0, pointerEase: 0.066, scrollEase: 0.092, scrollScale: 3.05, glassPower: 0.82 };
        }
        return { pixelRatio: 1.18, pointerEase: 0.046, scrollEase: 0.082, scrollScale: 4.25, glassPower: 1.04 };
      }

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const geometry = new THREE.PlaneGeometry(2, 2);
      const uniforms = {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uPointer: { value: new THREE.Vector2(0.5, 0.5) },
        uScroll: { value: 0 },
        uMobile: { value: 0 },
        uGlassPower: { value: 1 }
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
          uniform float uGlassPower;

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

          float sheet(vec2 p, vec2 a, vec2 b, float r, float blur) {
            return 1.0 - smoothstep(r, r + blur, sdCapsule(p, a, b, r));
          }

          float rim(float d, float width) {
            return 1.0 - smoothstep(0.0, width, abs(d));
          }

          void main() {
            vec2 uv = vUv;
            vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
            vec2 p = (uv - 0.5) * aspect;
            vec2 pointer = (uPointer - 0.5) * aspect;
            float mobile = uMobile;
            p.x *= mix(1.0, 0.78, mobile);
            pointer *= mix(1.0, 0.42, mobile);

            float progress = uScroll;
            float phase = progress * mix(0.82, 0.64, mobile);
            float stage = smoothstep(0.0, 1.0, clamp(progress * mix(0.23, 0.31, mobile), 0.0, 1.0));
            float lower = smoothstep(0.62, 1.72, progress);
            float s = 0.5 + 0.5 * sin(phase);
            s = smoothstep(0.0, 1.0, s);
            float depth = smoothstep(0.0, 1.0, min(progress, 1.0));
            float t = uTime * mix(0.25, 0.20, mobile);
            vec2 bend = vec2(
              sin(p.y * 2.7 + t + phase) * 0.045 + sin(p.y * 5.1 - t * 0.8) * 0.018,
              sin(p.x * 2.2 - t * 0.7 + phase * 0.5) * 0.026
            );

            vec2 drift = vec2(mix(-0.20, 0.22, s), mix(0.16, -0.18, s));
            drift += vec2(sin(t * 0.7) * 0.026, cos(t * 0.6) * 0.022);
            drift = mix(drift, vec2(mix(-0.08, 0.08, s), mix(0.23, -0.27, s)), mobile);
            drift += vec2(sin(stage * 2.1) * 0.035, cos(stage * 1.4) * 0.026) * lower * (1.0 - mobile * 0.35);

            vec2 pa = p + bend;
            vec2 a1 = rot(0.02 + s * 0.54) * vec2(-1.22, 0.28) + drift + pointer * 0.052;
            vec2 b1 = rot(0.02 + s * 0.54) * vec2(0.84, -0.05) + drift + vec2(sin(t) * 0.042, cos(t) * 0.030);
            vec2 a2 = rot(-0.60 + s * 0.82) * vec2(-0.82, -0.47) - drift * 0.72 + pointer * 0.032;
            vec2 b2 = rot(-0.60 + s * 0.82) * vec2(1.12, 0.36) - drift * 0.72;
            vec2 a3 = rot(0.88 - s * 0.50) * vec2(-1.02, -0.03) + vec2(0.16, 0.18) - drift * 0.22;
            vec2 b3 = rot(0.88 - s * 0.50) * vec2(0.72, 0.18) + vec2(0.16, 0.18) - drift * 0.22 + pointer * 0.030;

            float d1 = sdCapsule(pa, a1, b1, mix(0.108, 0.136, mobile));
            float d2 = sdCapsule(pa, a2, b2, mix(0.092, 0.116, mobile));
            float d3 = sdCapsule(pa, a3, b3, mix(0.058, 0.084, mobile));
            float glassA = 1.0 - smoothstep(0.0, mix(0.25, 0.30, mobile), d1);
            float glassB = 1.0 - smoothstep(0.0, mix(0.21, 0.25, mobile), d2);
            float glassC = 1.0 - smoothstep(0.0, mix(0.18, 0.22, mobile), d3);
            float lowerStage = clamp(stage + sin(t * 0.26 + progress * 0.33) * 0.06, 0.0, 1.0);
            vec2 lowerCenter = vec2(0.02 + sin(progress * 0.29) * 0.10, -0.18 + cos(progress * 0.21) * 0.06);
            vec2 lp = rot(phase * 0.72 + t * 0.36) * (pa - lowerCenter);
            float lowerFanA = sheet(lp, vec2(-1.04, 0.04), vec2(0.96, -0.02), mix(0.078, 0.104, mobile), mix(0.18, 0.23, mobile));
            float lowerFanB = sheet(lp, vec2(-0.86, -0.26), vec2(0.78, 0.20), mix(0.054, 0.078, mobile), mix(0.15, 0.20, mobile));
            float longPane = 1.0 - smoothstep(0.0, mix(0.24, 0.30, mobile), abs((pa.x * 0.54 - pa.y * 0.86) - mix(0.56, -0.40, lowerStage)));
            float quietPane = 1.0 - smoothstep(0.0, mix(0.18, 0.23, mobile), abs((pa.x * -0.42 - pa.y * 0.74) - mix(-0.44, 0.34, lowerStage)));
            float lowerFan = lowerFanA * 0.58 + lowerFanB * 0.44;
            float field = glassA * 0.78 + glassB * 0.62 + glassC * 0.42 + lower * (longPane * 0.18 + quietPane * 0.10 + lowerFan * 0.34);

            float core = smoothstep(0.16, 0.78, field);
            float edge = rim(d1, 0.024) * 0.95 + rim(d2, 0.020) * 0.72 + rim(d3, 0.018) * 0.52;
            float glintA = 1.0 - smoothstep(0.0, 0.018, abs(d1 + 0.052 + sin(pa.x * 3.3 + t) * 0.010));
            float glintB = 1.0 - smoothstep(0.0, 0.014, abs(d2 + 0.038 + sin(pa.y * 3.1 - t * 0.8) * 0.008));
            float sweep = smoothstep(0.030, 0.0, abs((pa.x + pa.y * 0.52) - mix(-0.56, 0.58, s)));
            float lowerSweep = smoothstep(0.042, 0.0, abs((pa.x * 0.32 - pa.y) - mix(0.52, -0.36, lowerStage)));
            float lowerFanGlint = rim(sdCapsule(lp, vec2(-1.04, 0.04), vec2(0.96, -0.02), mix(0.078, 0.104, mobile)), 0.020);
            float caustic = (glintA * 0.72 + glintB * 0.48 + sweep * 0.42 + lowerSweep * lower * 0.30 + lowerFanGlint * lower * 0.42 + longPane * lower * 0.10) * core;

            vec3 teal = vec3(0.17, 0.47, 0.42);
            vec3 sage = vec3(0.63, 0.72, 0.66);
            vec3 warm = vec3(0.66, 0.47, 0.30);
            vec3 pearl = vec3(0.94, 0.96, 0.93);
            vec3 color = mix(teal, warm, clamp(uv.x + s * 0.18, 0.0, 1.0));
            color = mix(color, sage, 0.24 + 0.18 * sin(t + uv.y * 3.1));
            color = mix(color, pearl, edge * 0.28 + caustic * 0.22);
            color = mix(color, mix(sage, warm, 0.28), lower * (0.20 + longPane * 0.12 + lowerFan * 0.16));
            color += vec3(1.0, 0.97, 0.88) * caustic * 0.22;

            float grain = sin(dot(uv * uResolution.xy, vec2(0.067, 0.041)) + uTime * 0.35) * 0.006;
            float alpha = core * mix(0.29, 0.23, mobile) + edge * mix(0.17, 0.125, mobile) + caustic * 0.082 + lower * (longPane * 0.052 + quietPane * 0.034 + lowerFan * mix(0.086, 0.058, mobile)) + grain;
            alpha *= mix(1.0, mix(0.92, 0.84, mobile), depth);
            alpha *= uGlassPower;

            gl_FragColor = vec4(color, clamp(alpha, 0.0, mix(0.45, 0.31, mobile)));
          }
        `
      });

      scene.add(new THREE.Mesh(geometry, material));

      const pointer = { x: 0.5, y: 0.52 };
      const eased = { x: pointer.x, y: pointer.y };
      let scrollTarget = 0;
      let scrollValue = 0;

      function resize() {
        const current = settings();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, current.pixelRatio));
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
        uniforms.uMobile.value = mobileQuery.matches ? 1 : 0;
        uniforms.uGlassPower.value = current.glassPower;
      }

      function updateScroll(scrollY = smooth.current) {
        const hero = document.querySelector(".hero-wrap");
        const max = Math.max(hero.offsetHeight - window.innerHeight, 1);
        const heroProgress = Math.min(Math.max(scrollY / max, 0), 1);
        const pageMax = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
        scrollTarget = Math.max(scrollY / pageMax, 0) * settings().scrollScale;
        document.documentElement.style.setProperty("--hero-progress", heroProgress.toFixed(4));
        document.documentElement.style.setProperty("--lens-y", `${Math.sin(scrollY * 0.0016) * 70 - scrollY * 0.045}px`);
        document.documentElement.style.setProperty("--glass-intensity", `${Math.min(Math.max(scrollY / Math.max(window.innerHeight, 1), 0), 1).toFixed(4)}`);
      }

      function updatePointer(event) {
        if (event.pointerType === "touch") return;
        pointer.x = event.clientX / window.innerWidth;
        pointer.y = 1 - event.clientY / window.innerHeight;
        document.documentElement.style.setProperty("--mx", `${(pointer.x - 0.5) * 30}px`);
        document.documentElement.style.setProperty("--my", `${(0.5 - pointer.y) * 24}px`);
        document.documentElement.style.setProperty("--pointer-x", `${(pointer.x - 0.5).toFixed(4)}`);
        document.documentElement.style.setProperty("--pointer-y", `${(pointer.y - 0.5).toFixed(4)}`);
      }

      function animate(time) {
        const visualScroll = updateSmoothScroll();
        updateScroll(visualScroll);
        updateRevealMotion(visualScroll);
        updateActiveNav(visualScroll);
        const current = settings();
        eased.x += (pointer.x - eased.x) * current.pointerEase;
        eased.y += (pointer.y - eased.y) * current.pointerEase;
        scrollValue += (scrollTarget - scrollValue) * current.scrollEase;
        uniforms.uTime.value = time * 0.001;
        uniforms.uPointer.value.set(eased.x, eased.y);
        uniforms.uScroll.value = scrollValue;
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
      }

      window.addEventListener("resize", () => {
        resize();
        configureSmoothScroll();
        updateScroll(smooth.current);
      }, { passive: true });
      window.addEventListener("pointermove", updatePointer, { passive: true });

      configureSmoothScroll();
      resize();
      updateScroll(smooth.current);
      updateRevealMotion(smooth.current);
      updateActiveNav(smooth.current);
      requestAnimationFrame(animate);
    } else {
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
