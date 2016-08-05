/* convert.frag
 * ------------
 * Used when converting RGB -> XYV (x, y, value). */

precision highp float;

varying float vValue;
uniform sampler2D uTex0;
uniform vec4 uColor;
varying vec2 vTexcoord0;

void main (void) {
   gl_FragColor = vec4 (1.00, 1.00, 1.00, vValue) *
      texture2D (uTex0, vTexcoord0) * uColor;
}
