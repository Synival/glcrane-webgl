// DOM elements to be linked in window.onload().
var domCanvas, domCrane, domViewer, domVertex, domFragment,
    domOuter, domErrors;

// Generic object-loading.
var objectLoadCount, objectLoadTotal, objectLoadQueue = [];
var errorText;

// 3D models.
var modelCrane, modelViewer;

// WebGL context, shaders, attributes, matrices, etc.
var gl;
var shaderVertex, shaderFragment, shaderProgram;
var matrixPerspective,  matrixModelView, matrixNormal,
    matrixOrthographic, matrixIdentity4, matrixIdentity3;
var textureArray = [];

// Animation and frame data.
var frameLast    = 0.00;
var frameCurrent = 0.00;
var frameT       = 0.00;

// Our program starts here.
window.onload = function() {
   // Now our DOM is ready, Link elements to variables.
   domCanvas    = document.getElementById ("canvas");
   domCrane     = document.getElementById ("crane");
   domViewer    = document.getElementById ("viewer");
   domVertex    = document.getElementById ("vertex");
   domFragment  = document.getElementById ("fragment");
   domOuter     = document.getElementById ("outer");
   domErrors    = document.getElementById ("errors");

   // Initialize matrices.
   matrixPerspective  = mat4.create ();
   matrixModelView    = mat4.create ();
   matrixNormal       = mat3.create ();
   matrixOrthographic = mat4.create ();
   matrixIdentity4    = mat4.identity (mat4.create ());
   matrixIdentity3    = mat3.identity (mat3.create ());

   // Initialize canvas size.
   window.onresize = windowResize;
   windowResize ();

   // Load our objects.
   objectQueue (domCrane,    "crane.obj");
   objectQueue (domViewer,   "viewer.obj");
   objectQueue (domVertex,   "shader.vert");
   objectQueue (domFragment, "shader.frag");
   objectLoad ();
}

function objectQueue (object, url) {
   // Add to our list of objects to load.
   objectLoadQueue.push ({ object: object, url: url });
}

function objectLoad () {
   // Keep track of how many objects we are to load.
   objectLoadTotal = objectLoadQueue.length;
   objectLoadCount = 0;

   // Send ajax requests to load all objects via jQuery.
   for (var i = 0; i < objectLoadTotal; i++) {
      var o = objectLoadQueue[i];
      $(o.object).load (o.url, null, objectLoadCallback (o.url));
   }
}

function windowResize () {
   // Send resize elements to document elements.
   canvasResize ();
}

function canvasResize () {
   // Resize canvas to element dimensions.
   domCanvas.width  = domCanvas.clientWidth;
   domCanvas.height = domCanvas.clientHeight;

   // Make sure our WebGL context is the proper size.
   if (gl) {
      gl.viewportWidth  = canvas.width;
      gl.viewportHeight = canvas.height;
      glInitScreen ();
   }
}

function objectLoadCallback (url) {
   // Encapsulate 'url' into our callback.
   return function (responseText, textStatus, xhr) {
      // Add to our error canvas if it didn't load.
      if (textStatus != "success") {
         errorAddText ("Couldn't load '" + url + "'");
         return;
      }

      // Increase loaded object count. If we reached the total, finish.
      objectLoadCount++;
      if (objectLoadCount == objectLoadTotal)
         objectsDone ();
   }
}

function objectsDone () {
   // Intialize WebGL.
   try {
      glInit (domCanvas);
   }
   catch (e) {
      errorAddText (e.toString ());
      throw e;
   }
}

function glInit (canvas) {
   // Load a WebGL context.
   try {
      gl = canvas.getContext ("experimental-webgl");
      gl.viewportWidth  = canvas.width;
      gl.viewportHeight = canvas.height;
   }
   catch (e) {
      if (!gl)
         errorAddText ("Couldn't load WebGL.");
      throw e;
   }

   // Load our shaders.
   shaderVertex   = glLoadShader (gl.VERTEX_SHADER,
      domVertex.innerHTML);
   shaderFragment = glLoadShader (gl.FRAGMENT_SHADER,
      domFragment.innerHTML);
   shaderProgram  = glCreateProgram ([shaderVertex, shaderFragment]);

   // Load our crane object.
   modelCrane = new OBJ.Mesh (domCrane.innerHTML);
   OBJ.initMeshBuffers (gl, modelCrane);

   // Load our texture viewer.
   modelViewer = new OBJ.Mesh (domViewer.innerHTML);
   OBJ.initMeshBuffers (gl, modelViewer);

   // Load textures.
   textureArray.shadow = glLoadTexture ("images/shadow.png");
   textureArray.paper  = glLoadTexture ("images/paper.jpg");
   textureArray.fire   = glLoadTexture ("images/fire.jpg");
   textureArray.UV     = glLoadTexture ("images/uv_map.jpg");

   // Draw everything back a bit, rotated downward 30 degrees.
   mat4.identity (matrixModelView);
   var v = vec3.create ();
   vec3.set (v, 0.00, 0.00, -5.00);
   mat4.translate (matrixModelView, matrixModelView, v);
   vec3.set (v, 1.00, 0.00, 0.00);
   mat4.rotate (matrixModelView, matrixModelView, 30.00 / 180.00 * Math.PI, v);

   // Make sure our normals are adjusted properly.
   glUpdateNormalMatrix ();

   // Proper render state.
   gl.enable (gl.DEPTH_TEST);
   gl.depthFunc (gl.LESS);
   gl.enable (gl.CULL_FACE);
   gl.cullFace (gl.BACK);
   gl.enable (gl.BLEND);
   gl.blendFunc (gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

   // Everything worked!  Activate our screen.
   glInitScreen ();
   glNextFrame (0.00);
}

function glLoadTexture (url)
{
   var element = new Image ();
   var id = gl.createTexture ();
   id.complete = false;
   element.onload = function() {
      gl.bindTexture (gl.TEXTURE_2D, id);
      gl.pixelStorei (gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D (gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
                     element);
      gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture (gl.TEXTURE_2D, null);
      id.complete = true;
      glCheckError ();
   }
   element.src = url;
   return id;
}

function glNextFrame (t) {
   // Keep track of our frame time.
   frameLast    = frameCurrent;
   frameCurrent = t / 1000.00;
   frameT       = (frameCurrent - frameLast);

   // Slowly rotate.
   var vec = vec3.create ();
   vec3.set (vec, 0.00, 1.00, 0.00);
   mat4.rotate (matrixModelView, matrixModelView,
      (15.00 / 180.00) * frameT * Math.PI, vec);
   glUpdateNormalMatrix ();

   // Redraw our scene.
   glDrawScene ();
   requestAnimationFrame (glNextFrame);
}

function glInitScreen () {
   // Make sure it's using the proper size.
   gl.viewportWidth  = domCanvas.width;
   gl.viewportHeight = domCanvas.height;
   gl.viewport (0, 0, gl.viewportWidth, gl.viewportHeight);

   // Get the width:height ratio.
   var r = gl.viewportWidth / gl.viewportHeight;

   // Render with a 45 degree FOV.
   mat4.perspective (matrixPerspective, 45.00 / 180.00 * Math.PI,
      r, 1.5, 100.0);

   // Set up our orthographic matrix.
   mat4.ortho (matrixOrthographic, 1 - (r * 4), 1, 1, -3, -100, 100);
}

function glUpdateNormalMatrix() {
   // Math!
   mat3.fromMat4  (matrixNormal, matrixModelView);
   mat3.invert    (matrixNormal, matrixNormal);
   mat3.transpose (matrixNormal, matrixNormal);
}

function glCheckError () {
   var err = gl.getError ();
   if (err != gl.NO_ERROR) {
      console.log (new Error().stack);
   }
}

function glSetUniforms (viewer) {
   // Is this our texture viewer?
   if (viewer) {
      gl.uniformMatrix4fv (shaderProgram.uMatrixProjection, false,
         matrixOrthographic);
      gl.uniformMatrix4fv (shaderProgram.uMatrixModelView, false,
         matrixIdentity4);
      gl.uniformMatrix3fv (shaderProgram.uMatrixNormal, false,
         matrixIdentity3);
      gl.uniform1fv (shaderProgram.uLightIntensity, [0.00]);
   }
   // If not, use our standard 3D matrices.
   else {
      gl.uniformMatrix4fv (shaderProgram.uMatrixProjection, false,
         matrixPerspective);
      gl.uniformMatrix4fv (shaderProgram.uMatrixModelView, false,
         matrixModelView);
      gl.uniformMatrix3fv (shaderProgram.uMatrixNormal, false,
         matrixNormal);
      gl.uniform1fv (shaderProgram.uLightIntensity, [1.00]);
   }

   // Inform our shader of the time.
   gl.uniform1fv (shaderProgram.uTime, [frameCurrent]);
   glCheckError ();
}

function glDrawScene () {
   // Black screen.
   gl.clearColor (0.25, 0.25, 0.25, 1.00);
   gl.clear (gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

   // Set our matrices.
   glSetUniforms (false);
   glDrawObject (modelCrane, {
      Sombra:"shadow",
      PapelOrigami:"fire"});

   // Set up an orthographic matrix for our texture viewer.
   glSetUniforms (true);
   glDrawObject (modelViewer, {
      Sombra:"shadow",
      PapelOrigami:"fire"});
}

function glDrawObject (obj, textures)
{
   // Bind vertex positions.
   gl.bindBuffer (gl.ARRAY_BUFFER, obj.vertexBuffer);
   gl.vertexAttribPointer (shaderProgram.aPosition,
      obj.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

   // Bind vertex normals.
   gl.bindBuffer (gl.ARRAY_BUFFER, obj.normalBuffer);
   gl.vertexAttribPointer (shaderProgram.aNormal,
      obj.normalBuffer.itemSize, gl.FLOAT, false, 0, 0);

   // Bind texture coordinates.
   gl.bindBuffer (gl.ARRAY_BUFFER, obj.textureBuffer);
   gl.vertexAttribPointer (shaderProgram.aTexcoord0,
      obj.textureBuffer.itemSize, gl.FLOAT, false, 0, 0);

   // Draw all objects.
   for (var i = 0; i < obj.objects; i++) {
      if (!(m = obj.materials[i]))
         continue;
      if (!(t = textures[m]))
         continue;
      if (!textureArray[t] || !textureArray[t].complete)
         continue;
      gl.activeTexture (gl.TEXTURE0);
      gl.bindTexture (gl.TEXTURE_2D, textureArray[t]);
      gl.uniform1i (shaderProgram.uTex0, 0);

      gl.bindBuffer (gl.ELEMENT_ARRAY_BUFFER, obj.indexBuffer[i]);
      gl.drawElements (gl.TRIANGLES, obj.indexBuffer[i].numItems,
         gl.UNSIGNED_SHORT, 0);
   }
}

function glLoadShader (type, source) {
   // Attempt to compile our shader.
   var id = gl.createShader (type);
   gl.shaderSource (id, source);
   gl.compileShader (id);

   // Complain if the shader is not complete.
   if (!gl.getShaderParameter (id, gl.COMPILE_STATUS)) {
      var log = removeTrailing (gl.getShaderInfoLog (id));
      throw gl.getShaderInfoLog (id);
   }

   // Return our complete shader.
   return id;
}

function glCreateProgram (shaders) {
   // Create the program object and attach everything in shaders[].
   var id = gl.createProgram ();
   for (var i = 0; i < shaders.length; i++)
      gl.attachShader (id, shaders[i]);

   // Does this link properly?
   gl.linkProgram (id);
   if (!gl.getProgramParameter (id, gl.LINK_STATUS))
      throw new String("Couldn't link program");

   // Get and enable vertex attributes.
   gl.useProgram (id);
   id.aPosition  = gl.getAttribLocation (id, "aPosition");
   id.aNormal    = gl.getAttribLocation (id, "aNormal");
   id.aTexcoord0 = gl.getAttribLocation (id, "aTexcoord0");
   gl.enableVertexAttribArray (id.aPosition);
   gl.enableVertexAttribArray (id.aNormal);
   gl.enableVertexAttribArray (id.aTexcoord0);

   // Get uniform locations.
   id.uMatrixProjection = gl.getUniformLocation (id, "uMatrixProjection");
   id.uMatrixModelView  = gl.getUniformLocation (id, "uMatrixModelView");
   id.uMatrixNormal     = gl.getUniformLocation (id, "uMatrixNormal");
   id.uTex0             = gl.getUniformLocation (id, "uTex0");
   id.uTime             = gl.getUniformLocation (id, "uTime");
   id.uLightIntensity   = gl.getUniformLocation (id, "uLightIntensity");

   // Return our new object handle.
   return id;
}

function errorAddText (text) {
   if (!errorText) {
      errorText = text;
      domErrors.style.display = "block";
   }
   else
      errorText += "\n" + text;
   errorUpdateText (errorText);
}

function errorUpdateText (text) {
   // How many lines in text?
   if (!text)
      return;
   var lines = text.split ('\n');

   // Get maximum width/height for drawing.
   var maxw = domOuter.offsetWidth  * 0.95;
   var maxh = domOuter.offsetHeight * 0.95;
   var size = 32;

   domErrors.innerHTML = "";
   domErrors.style.fontSize = size + "px";
   domErrors.innerHTML = text;

   if (domErrors.offsetWidth > maxw) {
      var ratio = maxw / domErrors.offsetWidth;
      size *= ratio;
      domErrors.style.fontSize = size + "px";
   }
   if (domErrors.offsetHeight > maxh) {
      var ratio = maxh / domErrors.offsetHeight;
      size *= ratio;
      domErrors.style.fontSize = size + "px";
   }
}

function removeTrailing (string) {
   var newLen = string.length;
   for (var i = newLen - 1; i > 0; i--) {
      if (string[i] == '\n' || string[i] == '\r' ||
          string[i] == ' '  || string[i] == '\0') {
         newLen = i;
      }
      else
         break;
   }
   return string.substr (0, newLen);
}
