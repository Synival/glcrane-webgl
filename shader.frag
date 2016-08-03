/* shader.frag
 * -----------
 * Fragment shader used for all rendering. */

precision mediump float;

varying vec3 vNormal;
varying vec2 vTexcoord0;
varying float vLight;

uniform sampler2D uTex0;

void main (void) {
   gl_FragColor = texture2D (uTex0, vTexcoord0);
#if 0
   gl_FragColor.rgb *= mix (vec3 (vLight, vLight, vLight), vec3 (
      sin ((vLight + 0.00) * 6.283) * 0.50 + 0.50,
      sin ((vLight + 0.33) * 6.283) * 0.50 + 0.50,
      sin ((vLight + 0.66) * 6.283) * 0.50 + 0.50), 0.25);
#else
   gl_FragColor.rgb *= vLight;
#endif
}
