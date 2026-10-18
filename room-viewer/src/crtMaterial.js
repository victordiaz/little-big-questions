import * as THREE from 'three'

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = /* glsl */ `
uniform sampler2D map;
uniform mat3 uvTransform;
uniform float time;
uniform float power; // 0 = off, 1 = fully on; in between plays the CRT on/off collapse

varying vec2 vUv;

const float LINES = 240.0;
const vec3 GLASS_OFF = vec3(0.03, 0.033, 0.037);

// Bulge the picture like a curved CRT face.
vec2 curve(vec2 uv) {
  uv = uv * 2.0 - 1.0;
  vec2 o = abs(uv.yx) / vec2(5.0, 4.0);
  uv += uv * o * o;
  return uv * 0.5 + 0.5;
}

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = curve(vUv);
  // faint reflection on the glass, visible mostly when the set is off
  float sheen = smoothstep(0.7, 0.0, length(vUv - vec2(0.3, 0.75))) * 0.04;
  vec3 col = GLASS_OFF;

  bool inside = uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0;
  if (inside && power > 0.0) {
    // Power-on: a dot widens into a horizontal line (first 35%), then the line opens up.
    // Power-off runs the same curve backwards.
    float sx = max(clamp(power / 0.35, 0.0, 1.0), 0.01);
    float sy = clamp((power - 0.35) / 0.65, 0.0, 1.0);
    sy = max(sy * sy * (3.0 - 2.0 * sy), 0.008);

    vec2 c = uv - 0.5;
    vec2 q = c / vec2(sx, sy);
    if (abs(q.x) <= 0.5 && abs(q.y) <= 0.5) {
      vec2 tuv = (uvTransform * vec3(q + 0.5, 1.0)).xy;
      float ab = 0.0018; // chromatic fringing
      vec3 v = vec3(
        texture2D(map, tuv + vec2(ab, 0.0)).r,
        texture2D(map, tuv).g,
        texture2D(map, tuv - vec2(ab, 0.0)).b
      );
      // phosphors: a bit more contrast and saturation than the source, so AgX doesn't wash it out
      v = pow(v, vec3(1.35));
      v = mix(vec3(dot(v, vec3(0.299, 0.587, 0.114))), v, 1.25);
      // the thinner the beam, the hotter it burns
      float flash = 1.0 - sy;
      v = mix(v, vec3(1.0), flash * 0.85) * (1.0 + flash * 2.5);
      col = v;
    }
    // lingering phosphor dot while the beam is collapsed
    float dotGlow = (1.0 - smoothstep(0.0, 0.35, power)) * exp(-dot(c, c) * 500.0) * 3.0;
    col += vec3(dotGlow);

    // scanlines, faded out when they get too dense on screen to avoid moiré
    float density = fwidth(uv.y) * LINES;
    float scanAmt = 0.3 * (1.0 - smoothstep(0.6, 1.0, density));
    col *= 1.0 - scanAmt + scanAmt * sin(uv.y * LINES * 6.28318);

    // aperture grille (RGB stripes)
    float m = mod(gl_FragCoord.x, 3.0);
    col *= vec3(m < 1.0 ? 1.0 : 0.82, (m >= 1.0 && m < 2.0) ? 1.0 : 0.82, m >= 2.0 ? 1.0 : 0.82);

    // vignette, flicker and a little noise
    vec2 vg = uv * (1.0 - uv.yx);
    col *= pow(clamp(vg.x * vg.y * 15.0, 0.0, 1.0), 0.25);
    col *= 1.0 + 0.025 * sin(time * 110.0);
    col += (rand(uv + fract(time)) - 0.5) * 0.05 * power;
    col = max(col * 0.85, GLASS_OFF);
  }

  gl_FragColor = vec4(col + sheen, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function createCRTMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: texture },
      uvTransform: { value: texture.matrix },
      time: { value: 0 },
      power: { value: 0 },
    },
    vertexShader,
    fragmentShader,
  })
}
