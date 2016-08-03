/* shader.frag
 * -----------
 * Fragment shader used for all rendering. */

precision highp float;

varying vec3 vNormal;
varying vec2 vTexcoord0;
varying float vLight;

uniform sampler2D uTex0;
uniform float uTime;

void main (void) {
   gl_FragColor = texture2D (uTex0, vec2 (vTexcoord0.s, vTexcoord0.t));

   /* crystal-like colors and refraction. */
#if 0
   float t = uTime * 0.125;
   gl_FragColor.rgb *= mix (vec3 (vLight, vLight, vLight), vec3 (
      sin ((vLight + 0.00 + t) * 3.141 * 4.00) * 0.50 + 0.50,
      sin ((vLight + 0.33 + t) * 3.141 * 4.00) * 0.50 + 0.50,
      sin ((vLight + 0.66 + t) * 3.141 * 4.00) * 0.50 + 0.50), 0.50);
#else
   gl_FragColor.rgb *= vLight;
#endif
}
