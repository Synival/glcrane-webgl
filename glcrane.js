// DOM elements to be linked in window.onload().
var domCanvas, domCrane, domViewer, domPaint, domNormalVertex,
    domNormalFragment, domOuter, domErrors, domConvertVertex,
    domConvertFragment;

// Generic object/texture loading.
var objectLoadCount, objectLoadTotal, objectLoadQueue = [];
var textureLoadCount, textureLoadTotal;
var errorText;

// 3D models.
var modelCrane, modelViewer, modelPaint;

// WebGL context, shaders, attributes, matrices, etc.
var gl;
var shaderNormalVertex,  shaderNormalFragment,  shaderNormalProgram,
    shaderConvertVertex, shaderConvertFragment, shaderConvertProgram,
    shaderProgram;
var matrixPerspective,  matrixModelView, matrixNormal,
    matrixOrthographic, matrixIdentity4, matrixIdentity3,
    matrixViewer;
var textureArray = [];
var fbPicking, fbModel, fbCurrent = null;
var colorWhite = [1.00, 1.00, 1.00, 1.00],
    colorBlack = [0.00, 0.00, 0.00, 1.00];

// Animation and frame data.
var frameLast    = 0.00;
var frameCurrent = 0.00;
var frameT       = 0.00;

// Spraypainting stuff.
var mouseDrawColor = colorWhite;
var mouseDrawSize  = 0.05;
var mouseDown      = false;
var mouseX         = null;
var mouseY         = null;
var mouseYflip     = null;
var mouseU         = null;
var mouseV         = null;
var mouseLastU     = null;
var mouseLastV     = null;

// Debug tools.
var debugUV    = false;

// Our program starts here.
window.onload = function() {
   // Now our DOM is ready, Link elements to variables.
   domCanvas          = document.getElementById ("canvas");
   domCrane           = document.getElementById ("crane");
   domViewer          = document.getElementById ("viewer");
   domPaint           = document.getElementById ("paint");
   domNormalVertex    = document.getElementById ("normal_vertex");
   domNormalFragment  = document.getElementById ("normal_fragment");
   domConvertVertex   = document.getElementById ("convert_vertex");
   domConvertFragment = document.getElementById ("convert_fragment");
   domOuter           = document.getElementById ("outer");
   domErrors          = document.getElementById ("errors");

   // Initialize matrices.
   matrixPerspective  = mat4.create ();
   matrixModelView    = mat4.create ();
   matrixNormal       = mat3.create ();
   matrixOrthographic = mat4.create ();
   matrixIdentity4    = mat4.create ();
   matrixIdentity3    = mat3.create ();
   matrixViewer       = mat4.create ();

   // Initialize canvas size.
   window.onresize = windowResize;
   windowResize ();

   // Load our objects.
   objectQueue (domCrane,           "crane.obj");
   objectQueue (domViewer,          "viewer.obj");
   objectQueue (domPaint,           "paint.obj");
   objectQueue (domNormalVertex,    "normal.vert");
   objectQueue (domNormalFragment,  "normal.frag");
   objectQueue (domConvertVertex,   "convert.vert");
   objectQueue (domConvertFragment, "convert.frag");
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
      glInit ();
   }
   catch (e) {
      errorAddText (e.toString ());
      throw e;
   }

   // Add events to our canvas.
   domCanvas.addEventListener ("mousedown",   canvasMouseDown);
   domCanvas.addEventListener ("touchstart",  canvasMouseDown);
   domCanvas.addEventListener ("mouseup",     canvasMouseUp);
   domCanvas.addEventListener ("touchend",    canvasMouseUp);
   domCanvas.addEventListener ("touchcancel", canvasMouseUp);
   domCanvas.addEventListener ("mousemove",   canvasMouseMove);
   domCanvas.addEventListener ("touchmove",   canvasMouseMove);
   window.addEventListener    ("keydown",     canvasKeyDown);
   window.addEventListener    ("keyup",       canvasKeyUp);
}

function glInitContext () {
   // Load a WebGL context.
   try {
      gl = domCanvas.getContext ("experimental-webgl");
      gl.viewportWidth  = domCanvas.width;
      gl.viewportHeight = domCanvas.height;
   }
   catch (e) {
      if (!gl)
         errorAddText ("Couldn't load WebGL.");
      throw e;
   }
}

function glInitShaders () {
   // Load our normal shader.
   shaderNormalVertex = glLoadShader (gl.VERTEX_SHADER,
      domNormalVertex.innerHTML);
   shaderNormalFragment = glLoadShader (gl.FRAGMENT_SHADER,
      domNormalFragment.innerHTML);
   shaderNormalProgram  = glCreateProgram (
      [shaderNormalVertex, shaderNormalFragment]);

   // Get and enable vertex attributes.
   var id = shaderNormalProgram;
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
   id.uColor            = gl.getUniformLocation (id, "uColor");

   // Load our RGB->XYV conversion shader shader.
   shaderConvertVertex = glLoadShader (gl.VERTEX_SHADER,
      domConvertVertex.innerHTML);
   shaderConvertFragment = glLoadShader (gl.FRAGMENT_SHADER,
      domConvertFragment.innerHTML);
   shaderConvertProgram  = glCreateProgram (
      [shaderConvertVertex, shaderConvertFragment]);

   // Get and enable vertex attributes.
   var id = shaderConvertProgram;
   gl.useProgram (id);
   id.aPosition  = gl.getAttribLocation (id, "aPosition");
   id.aTexcoord0 = gl.getAttribLocation (id, "aTexcoord0");
   gl.enableVertexAttribArray (id.aPosition);
   gl.enableVertexAttribArray (id.aTexcoord0);

   // Get uniform locations.
   id.uMatrixProjection = gl.getUniformLocation (id, "uMatrixProjection");
   id.uMatrixModelView  = gl.getUniformLocation (id, "uMatrixModelView");
   id.uTex0             = gl.getUniformLocation (id, "uTex0");
   id.uColor            = gl.getUniformLocation (id, "uColor");

   // Use our 'normal' program.
   glUseProgram (shaderNormalProgram);
}

function glInitModels () {
   // Load our crane object.
   modelCrane = new OBJ.Mesh (domCrane.innerHTML);
   OBJ.initMeshBuffers (gl, modelCrane);

   // Load our texture viewer.
   modelViewer = new OBJ.Mesh (domViewer.innerHTML);
   OBJ.initMeshBuffers (gl, modelViewer);

   // Load our spraypaint object.
   modelPaint = new OBJ.Mesh (domPaint.innerHTML);
   OBJ.initMeshBuffers (gl, modelPaint);
}

function glInitTextures () {
   // Build our array of textures to load.
   var modelTexture = glQueueTexture ("fire",   "images/fire.jpg");
   glQueueTexture ("shadow", "images/shadow.png");
   glQueueTexture ("paper",  "images/paper.jpg");
   glQueueTexture ("uv_map", "images/uv_map.jpg");
   glQueueTexture ("paint",  "images/paint.png");

   // When our main texture finishes, copy it to our framebuffer.
   modelTexture.whenFinished = function (id, element) {
      glFramebufferCopyTexture (fbModel, "fire");
   };

   // Start loading textures.
   glLoadTextures ();
}

function glFramebufferCopyTexture (fb, texture) {
   var matrix = glFramebufferOrtho (fb);
   glUseFramebuffer (fb);
   glSetUniforms (matrix, matrixIdentity4, matrixIdentity3, 0.00, colorWhite);
   glDrawObject (modelPaint, { Paint: texture });
   glUseFramebuffer (null);
}

function glInitFramebuffers () {
   // Screen-sized framebuffer used for UV picking.
   fbPicking = glCreateFramebuffer (gl.viewportWidth, gl.viewportHeight, true);

   // Our model's texture.
   fbModel = glCreateFramebuffer (512, 512, false);
   textureArray.model = fbModel.texture;
}

function glInitMatrices () {
   // Draw everything back a bit, rotated downward 30 degrees.
   mat4.identity (matrixModelView);
   var v = vec3.create ();
   vec3.set (v, 0.00, 0.00, -5.00);
   mat4.translate (matrixModelView, matrixModelView, v);
   vec3.set (v, 1.00, 0.00, 0.00);
   mat4.rotate (matrixModelView, matrixModelView, 30.00 / 180.00 * Math.PI, v);

   // Make sure our normals are adjusted properly.
   glUpdateNormalMatrix ();

   // Set up a generic orthographic matrix.
   mat4.ortho (matrixOrthographic, -1, 1, 1, -1, -100, 100);
   mat4.identity (matrixIdentity4);
   mat3.identity (matrixIdentity3);
}

function glInitState () {
   // Proper render state.
   gl.enable (gl.DEPTH_TEST);
   gl.depthFunc (gl.LESS);
/*
   gl.enable (gl.CULL_FACE);
   gl.cullFace (gl.BACK);
*/
   gl.enable (gl.BLEND);
   gl.blendFunc (gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

function glInit () {
   // Initialize a whole bunch of stuff.
   glInitContext ();
   glInitShaders ();
   glInitModels ();
   glInitFramebuffers ();
   glInitTextures ();
   glInitMatrices ();
   glInitState ();

   // Everything worked!  Activate our screen.
   glInitScreen ();
   glNextFrame (0.00);
}

function glQueueTexture (name, url)
{
   // Create an image and an OpenGL texture object.
   var element = new Image ();
   var id = gl.createTexture ();

   // We're going to use the GL object as our reference.
   // Store valuable info in it.
   id.url        = url;
   id.element    = element;
   id.incomplete = true;

   // Load the image data into the texture object when finished.
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
      id.incomplete = false;
      glCheckError ();

      // Anything else we need to do here?
      if (id.whenFinished)
         id.whenFinished (id, element);

      // Was this the last object?  Yay!
      textureLoadCount++;
      if (textureLoadCount == textureLoadTotal)
         glLoadTexturesDone ();
   }

   // Complain if we can't load the image.
   element.onerror = function() {
      errorAddText ("Couldn't load image '" + url + "'");
   }

   // Store in our texture array.
   textureArray[name] = id;
   return id;
}

function glLoadTextures () {
   // How many textures are we loading?
   textureLoadTotal = 0;
   for (var key in textureArray)
      if (textureArray[key].element)
         textureLoadTotal++;

   // Queue them all to load.
   textureLoadCount = 0;
   for (var key in textureArray) {
      var e = textureArray[key];
      if (e.element)
         e.element.src = e.url;
   }
}

function glLoadTexturesDone () {
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
   if (debugUV)
      glDrawScene (true);
   else {
      glDrawScene (false);
      glUseFramebuffer (fbPicking);
      glDrawScene (true);
      glUseFramebuffer (null);
      glCheckError ();
   }
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

   // Determine the position of our viewing window.
   mat4.identity (matrixViewer);
   mat4.scalar.scale (matrixViewer, matrixViewer, [0.50 / r, 0.50, 0.50]);
   mat4.scalar.translate (matrixViewer, matrixViewer, [r*2-1, 1.00, 0.00]);
}

function glUpdateNormalMatrix() {
   // Math!
   mat3.fromMat4  (matrixNormal, matrixModelView);
   mat3.invert    (matrixNormal, matrixNormal);
   mat3.transpose (matrixNormal, matrixNormal);
}

function glCheckError () {
   while (1) {
      var err = gl.getError ();
      if (err == gl.NO_ERROR)
         break;
      console.log (new Error().stack);
   }
}

function glSetUniforms (matp, matmv, matn, light, color) {
   if (shaderProgram.uMatrixProjection && matp != null)
      gl.uniformMatrix4fv (shaderProgram.uMatrixProjection, false, matp);
   if (shaderProgram.uMatrixModelView && matmv != null)
      gl.uniformMatrix4fv (shaderProgram.uMatrixModelView,  false, matmv);
   if (shaderProgram.uMatrixNormal && matn != null)
      gl.uniformMatrix3fv (shaderProgram.uMatrixNormal,     false, matn);
   if (shaderProgram.uLightIntensity && light != null)
      gl.uniform1fv (shaderProgram.uLightIntensity, [light]);
   if (shaderProgram.uTime && frameCurrent != null)
      gl.uniform1fv (shaderProgram.uTime, [frameCurrent]);
   if (shaderProgram.uColor && color != null)
      gl.uniform4fv (shaderProgram.uColor, color);
   glCheckError ();
}

function glClearScreen (v, a) {
   gl.clearColor (v, v, v, a);
   gl.clear (gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

function glDrawScene (picking) {
   // Different textures depending on mode.
   var textures = [], light;
   if (picking) {
      glClearScreen (0.00, 0.00);
      textures.PapelOrigami = "uv_map";
      light = 0.00;
   }
   else {
      glClearScreen (0.25, 1.00);
      textures.Sombra       = "shadow";
      textures.PapelOrigami = "model";
      light = 1.00;
   }

   // Draw our crane in perspective space.
   glSetUniforms (matrixPerspective, matrixModelView, matrixNormal, light,
      colorWhite);
   glDrawObject (modelCrane, textures);

   // Draw our texture in orthographic space.
   glSetUniforms (matrixOrthographic, matrixViewer, matrixIdentity3, 0.00,
      null);
   glDrawObject (modelViewer, textures);
}

function glDrawObject (obj, textures)
{
   glCheckError ();

   // Bind vertex positions.
   if (shaderProgram.aPosition >= 0) {
      gl.bindBuffer (gl.ARRAY_BUFFER, obj.vertexBuffer);
      gl.vertexAttribPointer (shaderProgram.aPosition,
         obj.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);
      glCheckError ();
   }

   // Bind vertex normals.
   if (shaderProgram.aNormal >= 0) {
      gl.bindBuffer (gl.ARRAY_BUFFER, obj.normalBuffer);
      gl.vertexAttribPointer (shaderProgram.aNormal,
         obj.normalBuffer.itemSize, gl.FLOAT, false, 0, 0);
      glCheckError ();
   }

   // Bind texture coordinates.
   if (shaderProgram.aTexcoord0 >= 0) {
      gl.bindBuffer (gl.ARRAY_BUFFER, obj.textureBuffer);
      gl.vertexAttribPointer (shaderProgram.aTexcoord0,
         obj.textureBuffer.itemSize, gl.FLOAT, false, 0, 0);
      glCheckError ();
   }

   // Draw all objects.
   for (var i = 0; i < obj.objects; i++) {
      if (!(m = obj.materials[i]))
         continue;
      if (!(t = textures[m]))
         continue;
      if (!textureArray[t] || textureArray[t].incomplete)
         continue;
      if (shaderProgram.uTex0) {
         gl.activeTexture (gl.TEXTURE0);
         gl.bindTexture (gl.TEXTURE_2D, textureArray[t]);
         gl.uniform1i (shaderProgram.uTex0, 0);
         glCheckError ();
      }
      gl.bindBuffer (gl.ELEMENT_ARRAY_BUFFER, obj.indexBuffer[i]);
      gl.drawElements (gl.TRIANGLES, obj.indexBuffer[i].numItems,
         gl.UNSIGNED_SHORT, 0);
      glCheckError ();
   }
}

function glCreateFramebuffer (width, height, depth) {
   // Create the framebuffer object and store our dimensions.
   var fid = gl.createFramebuffer ();
   glUseFramebuffer (fid);
   fid.width  = width;
   fid.height = height;

   // Attach a texture.
   var tid = gl.createTexture ();
   fid.texture = tid;
   gl.bindTexture (gl.TEXTURE_2D, tid);
   gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
   gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
   gl.texImage2D (gl.TEXTURE_2D, 0, gl.RGBA, fid.width, fid.height, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, null);

   // Create a render buffer.
   var rid = gl.createRenderbuffer ();
   fid.renderBuffer = rid;
   gl.bindRenderbuffer (gl.RENDERBUFFER, rid);
   gl.framebufferTexture2D (gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D, tid, 0);

   // Do we need a depth buffer?
   if (depth) {
      gl.renderbufferStorage (gl.RENDERBUFFER, gl.DEPTH_COMPONENT16,
         fid.width, fid.height);
      gl.framebufferRenderbuffer (gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
         gl.RENDERBUFFER, rid);
      gl.clear (gl.DEPTH_BUFFER_BIT);
   }

   // Texture is magenta by default.
   gl.clearColor (1.00, 0.00, 1.00, 1.00);
   gl.clear (gl.COLOR_BUFFER_BIT);

   // Unbind.
   glUseFramebuffer (null);
   gl.bindTexture      (gl.TEXTURE_2D,   null);
   gl.bindRenderbuffer (gl.RENDERBUFFER, null);

   // Return our new framebuffer object.
   return fid;
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

   // Return our new object handle.
   return id;
}

function glFramebufferOrtho (fb) {
   var m = mat4.create ();
   var r = gl.viewportWidth / gl.viewportHeight;
   var dx = ((gl.viewportWidth  - fb.width)  / fb.width) + 1;
   var dy = ((gl.viewportHeight - fb.height) / fb.height) + 1;
   mat4.identity (m);
   mat4.ortho (m, -1, -1 + dx * 2, 1, 1 - dy * 2, -100, 100);
   return m;
}

function glUseProgram (shader) {
   gl.useProgram (shader);
   shaderProgram = shader;
}

function glUseFramebuffer (fb) {
   gl.bindFramebuffer (gl.FRAMEBUFFER, fb);
   fbCurrent = fb;
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

function canvasMouseDown (e) {
   mouseDown = true;
   mouseSetCoordinates (this, e);
   mouseSetLast ();
   if (!mouseDraw ())
      mouseDownOff ();
   else
      e.preventDefault ();
}

function canvasMouseUp (e) {
   mouseDownOff ();
   e.preventDefault ();
}

function mouseDownOff () {
   mouseDown = false;
   mouseX     = null;
   mouseY     = null;
   mouseU     = null;
   mouseV     = null;
   mouseLastX = null;
   mouseLastY = null;
   mouseLastU = null;
   mouseLastV = null;
}

function canvasMouseMove (e) {
   if (!mouseDown)
      return;
   if (!mouseSetCoordinates (this, e))
      return;
   mouseDraw ();
   e.preventDefault ();
}

function canvasKeyDown (e) {
        if (e.key == "p") debugUV = true;
   else if (e.key == "1") {
      mouseDrawColor = colorBlack;
      glFramebufferCopyTexture (fbModel, "paper");
   }
   else if (e.key == "2") {
      mouseDrawColor = colorWhite;
      glFramebufferCopyTexture (fbModel, "fire");
   }
}

function canvasKeyUp (e) {
   if (e.key == "p")
      debugUV = false;
}

function mouseSetCoordinates (element, e)
{
   var rect = element.getBoundingClientRect ();
   var x, y;

   // Is there a touch event?
   if (e.touches)
      e = e.touches[0];

   // Prioritize using clientX, if available.
   if (e.clientX != undefined) {
      x = parseInt (e.clientX - rect.left);
      y = parseInt (e.clientY - rect.top);
   }
   else if (e.pageX != undefined) {
      x = parseInt (e.pageX - rect.left) - (window.pageXOffset),
      y = parseInt (e.pageY - rect.top)  - (window.pageYOffset);
   }
   else
      return;

   // We have the coordinates.  Have they changed?
   var change = true;
   if (x == mouseX && y == mouseY)
      change = false;
   // Different coordinates - update our 'last coordinates' and current ones.
   else {
      mouseSetLast ();
      mouseX = x;
      mouseY = y;
      mouseYflip = rect.height - y;
   }

   // Return whether or not we changed.
   return change;
}

function mouseSetLast () {
   mouseLastX = mouseX;
   mouseLastY = mouseY;
   mouseLastU = mouseU;
   mouseLastV = mouseV;
}

function mouseDrawVertexBuffer (w, h) {
   var id = gl.createBuffer ();
   id.itemSize = 4;
   gl.bindBuffer (gl.ARRAY_BUFFER, id);
   gl.vertexAttribPointer (shaderConvertProgram.aPosition,
      id.itemSize, gl.FLOAT, false, 0, 0);
   return id;
}

function mouseDrawIndexBuffer (w, h) {
   // Create all of our polygons.
   var x, y, array = [], count = 0, pos = 0;
   for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++, pos += 4) {
         if (Math.hypot ((x / w) - 0.50, (y / h) - 0.50) > 0.50)
            continue;
         array.push (pos + 0, pos + 1, pos + 3,
                     pos + 1, pos + 3, pos + 2);
         count += 6;
      }
   }

   // Put them into a buffer.
   var id = gl.createBuffer ();
   gl.bindBuffer (gl.ELEMENT_ARRAY_BUFFER, id);
   gl.bufferData (gl.ELEMENT_ARRAY_BUFFER, new Uint16Array (array),
      gl.STATIC_DRAW);
   id.numItems = count;

   // Return our new buffer.
   return id;
}

function mouseDrawTexcoordBuffer (w, h) {
   var id = gl.createBuffer ();
   id.itemSize = 2;
   gl.bindBuffer (gl.ARRAY_BUFFER, id);
   gl.vertexAttribPointer (shaderConvertProgram.aTexcoord0,
      id.itemSize, gl.FLOAT, false, 0, 0);

   // Populate our buffer.
   var array = new Float32Array (w * h * 2 * 4),
       wh24 = w * h * 2 * 4;
   for (var i = 0; i < wh24; i += 8) {
      array[i + 0] = 0.00;
      array[i + 1] = 0.00;
      array[i + 2] = 1.00;
      array[i + 3] = 0.00;
      array[i + 4] = 1.00;
      array[i + 5] = 1.00;
      array[i + 6] = 0.00;
      array[i + 7] = 1.00;
   }
   gl.bufferData (gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);

   return id;
}

var mdVertexBuffer   = undefined;
var mdIndexBuffer    = undefined;
var mdTexcoordBuffer = undefined;
function mouseDrawBuffers (w, h, pixelsf) {
   // Make sure we have our buffer + indices.
   gl.useProgram (shaderConvertProgram);
   if (!mdVertexBuffer)   mdVertexBuffer   = mouseDrawVertexBuffer   (w, h);
   if (!mdIndexBuffer)    mdIndexBuffer    = mouseDrawIndexBuffer    (w, h);
   if (!mdTexcoordBuffer) mdTexcoordBuffer = mouseDrawTexcoordBuffer (w, h);

   // Populate our buffer with the correct data.
   gl.bindBuffer (gl.ARRAY_BUFFER, mdVertexBuffer);
   gl.bufferData (gl.ARRAY_BUFFER, pixelsf, gl.STREAM_DRAW);
   gl.useProgram (shaderProgram);
}

var iStep = (mouseDrawSize * 0.25);
function mouseDraw () {
   return mouseDrawAt (mouseX, mouseY);
/*
   // What is the UV coordinate under the mouse?  Read a pixel from
   // the picking framebuffer.
   var pixels = new Uint8Array(4);
   gl.bindFramebuffer (gl.FRAMEBUFFER, fbPicking);
   gl.readPixels (mouseX, mouseYflip, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
   gl.bindFramebuffer (gl.FRAMEBUFFER, null);
   glCheckError ();

   // Do nothing if we're hovering over blank space.
   if (pixels[3] < 1.00) {
      mouseU = null;
      mouseV = null;
      return 0;
   }

   // Determine texture coordinate based on pixel read.
   mouseU = parseFloat (pixels[0]) / 255.00,
   mouseV = parseFloat (pixels[1]) / 255.00;

   // Keep track of how much we've drawn.
   var count = 0;

   // Draw a trail.
   var x = mouseU * 2.00 - 1.00, y = mouseV * 2.00 - 1.00;
   if (mouseLastU && mouseLastV) {
      var dist = Math.hypot (mouseU - mouseLastU, mouseV - mouseLastV);
      if (dist > iStep) {
         var ix = mouseLastU * 2.00 - 1.00, iy = mouseLastV * 2.00 - 1.00;
         var ixStep = (x - ix) / dist * iStep, iyStep = (y - iy) / dist * iStep;
         for (var i = iStep; i < dist; i += iStep) {
            ix += ixStep;
            iy += iyStep;
            mouseDrawAt (ix, iy);
            count++;
         }
      }
   }

   // Draw our destination.
   mouseDrawAt (x, y);
   return count + 1;
*/
}

function mouseDrawAt (x, y) {
   // Get the area we're drawing.
   var h = parseInt (gl.viewportHeight / 32.00), w = h,
       wh = w * h, wh4 = wh * 4, wh44 = wh4 * 4;

   var pixels = new Uint8Array (wh4);
   glUseFramebuffer (fbPicking);
   gl.readPixels (mouseX - w/2, mouseYflip - h/2, w, h, gl.RGBA,
      gl.UNSIGNED_BYTE, pixels);
   var pixelsf = new Float32Array (wh44);
   var i, j, k;

   var pw = 0.015625, pw2 = pw * 2;
   for (i = 0, j = 0; i < wh4; i += 4, j += 16) {
      pixelsf[j +  0] = pixels[i + 0] / 128.00 - 1.00 - pw;
      pixelsf[j +  1] = pixels[i + 1] / 128.00 - 1.00 - pw;
      pixelsf[j +  2] = pixels[i + 2] / 255.00;
      pixelsf[j +  3] = pixels[i + 3] / 255.00;

      pixelsf[j +  4] = pixelsf[j + 0] + pw2;
      pixelsf[j +  5] = pixelsf[j + 1];
      pixelsf[j +  6] = pixelsf[j + 2];
      pixelsf[j +  7] = pixelsf[j + 3];

      pixelsf[j +  8] = pixelsf[j + 0] + pw2;
      pixelsf[j +  9] = pixelsf[j + 1] + pw2;
      pixelsf[j + 10] = pixelsf[j + 2];
      pixelsf[j + 11] = pixelsf[j + 3];

      pixelsf[j + 12] = pixelsf[j + 0];
      pixelsf[j + 13] = pixelsf[j + 1] + pw2;
      pixelsf[j + 14] = pixelsf[j + 2];
      pixelsf[j + 15] = pixelsf[j + 3];
   }

   // Initialize all the buffers we need to draw.
   mouseDrawBuffers (w, h, pixelsf);

   glUseProgram (shaderConvertProgram);
   glUseFramebuffer (fbModel);

      var matrix = glFramebufferOrtho (fbModel);
      glSetUniforms (matrix, matrixIdentity4, matrixIdentity3, 0.00,
         mouseDrawColor);
      gl.activeTexture (gl.TEXTURE0);
      gl.bindTexture (gl.TEXTURE_2D, textureArray.paint);
      gl.uniform1i (shaderProgram.uTex0, 0);

      gl.bindBuffer (gl.ARRAY_BUFFER, mdVertexBuffer);
      gl.vertexAttribPointer (shaderProgram.aPosition,
         mdVertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

      gl.bindBuffer (gl.ARRAY_BUFFER, mdTexcoordBuffer);
      gl.vertexAttribPointer (shaderProgram.aTexcoord0,
         mdTexcoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

      gl.blendFuncSeparate (gl.ONE, gl.ONE_MINUS_SRC_ALPHA,
         gl.ONE, gl.ONE);
      gl.bindBuffer (gl.ELEMENT_ARRAY_BUFFER, mdIndexBuffer);
      gl.drawElements (gl.TRIANGLES, mdIndexBuffer.numItems,
         gl.UNSIGNED_SHORT, 0);
      gl.blendFunc (gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      glCheckError ();

   glUseFramebuffer (null);
   glUseProgram (shaderNormalProgram);

   return 1;
/*
   var ortho = glFramebufferOrtho (fbModel);

   // Set up a matrix for our drawing.
   var matrix = mat4.create ();
   mat4.identity (matrix);
   mat4.scalar.translate (matrix, matrix, [x, y, 1.00]);
   mat4.scalar.scale     (matrix, matrix, [mouseDrawSize, mouseDrawSize,1.00]);
   mat4.scalar.translate (matrix, matrix,
      [0.05 / mouseDrawSize, 0.05 / mouseDrawSize, 0]);

   // Place on paper.
   glSetUniforms (ortho, matrix, matrixIdentity3, 0.00, mouseDrawColor);

   // Bind our model texture framebuffer and perform a draw.
   glUseFramebuffer (fbModel);
   gl.blendFuncSeparate (gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA,
                         gl.ONE, gl.ONE);
   glDrawObject (modelPaint, { Paint: "paint" });
   gl.blendFunc (gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
   glUseFramebuffer (null);
*/
}
