/* shader.frag
 * -----------
 * Fragment shader used for all rendering. */

precision mediump float;
varying vec3 vNormal;
varying float vLight;

void main (void) {
   gl_FragColor = vec4 (1.00, 1.00, 1.00, 1.00) * vLight;
}
