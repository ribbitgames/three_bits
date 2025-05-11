/**
 * Three.js Mobile Game Library
 * A collection of optimized functions for creating mobile-friendly Three.js games
 */

const MobileGameLib = {
  /**
   * Creates an optimized WebGL renderer configured for mobile devices
   * @param {string} containerId - ID of the HTML element to contain the renderer
   * @param {Object} options - Optional renderer settings
   * @param {boolean} options.antialias - Whether to use antialiasing (default: false to improve performance)
   * @param {boolean} options.alpha - Whether to use alpha (default: false)
   * @param {number} options.pixelRatioLimit - Maximum pixel ratio to use (default: 2)
   * @returns {THREE.WebGLRenderer} Configured renderer
   */
  setupMobileRenderer: function(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container with ID "${containerId}" not found`);
      return null;
    }
    
    // Default options optimized for mobile
    const defaultOptions = {
      antialias: false,
      alpha: false,
      pixelRatioLimit: 2
    };
    
    const settings = { ...defaultOptions, ...options };
    
    // Create renderer with options
    const renderer = new THREE.WebGLRenderer({
      antialias: settings.antialias,
      alpha: settings.alpha,
      powerPreference: 'high-performance'
    });
    
    // Set pixel ratio (limited for performance)
    const pixelRatio = Math.min(window.devicePixelRatio, settings.pixelRatioLimit);
    renderer.setPixelRatio(pixelRatio);
    
    // Set size to container dimensions
    renderer.setSize(container.clientWidth, container.clientHeight);
    
    // Optimize renderer for mobile
    renderer.shadowMap.enabled = false; // Disable shadows by default for performance
    
    // Handle different versions of Three.js
    if (THREE.ColorManagement && THREE.SRGBColorSpace) {
      // Modern Three.js (r152+)
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding) {
      // Legacy Three.js
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    
    // Append canvas to container
    container.appendChild(renderer.domElement);
    
    // Return the configured renderer
    return renderer;
  },
  
  /**
   * Creates a scene with a responsive camera optimized for portrait mobile screens
   * @param {Object} options - Camera options
   * @param {number} options.fov - Field of view (default: 75)
   * @param {number} options.near - Near clipping plane (default: 0.1)
   * @param {number} options.far - Far clipping plane (default: 1000)
   * @param {number} options.z - Initial camera Z position (default: 5)
   * @returns {Object} Object containing scene and camera
   */
  createResponsiveScene: function(options = {}) {
    // Create scene
    const scene = new THREE.Scene();
    
    // Default camera options
    const defaultOptions = {
      fov: 75,
      near: 0.1,
      far: 1000,
      z: 5
    };
    
    const settings = { ...defaultOptions, ...options };
    
    // Calculate aspect ratio (assume portrait orientation for mobile)
    const container = document.body;
    const aspect = container.clientWidth / container.clientHeight;
    
    // Create perspective camera with responsive aspect ratio
    const camera = new THREE.PerspectiveCamera(
      settings.fov,
      aspect,
      settings.near,
      settings.far
    );
    
    // Position camera
    camera.position.z = settings.z;
    
    // Add resize handler to update camera aspect ratio
    window.addEventListener('resize', () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
    });
    
    return { scene, camera };
  },
  
  /**
   * Handles device orientation changes for responsive rendering
   * @param {THREE.WebGLRenderer} renderer - The renderer to adjust
   * @param {THREE.Camera} camera - The camera to adjust
   * @param {function} [callback] - Optional callback when orientation changes
   * @returns {function} Function to remove event listeners
   */
  handleDeviceOrientation: function(renderer, camera, callback) {
    const updateSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Update renderer size
      renderer.setSize(width, height);
      
      // Update camera aspect ratio
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      
      // Call optional callback
      if (typeof callback === 'function') {
        const isPortrait = height > width;
        callback(isPortrait, width, height);
      }
    };
    
    // Set up initial size
    updateSize();
    
    // Add event listeners
    window.addEventListener('resize', updateSize);
    window.addEventListener('orientationchange', updateSize);
    
    // Return function to remove listeners
    return function cleanup() {
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
    };
  },
  
  /**
   * Sets up touch and mouse controls optimized for thumb-based interaction
   * @param {HTMLElement} element - Element to attach events to
   * @param {Object} callbacks - Event callbacks
   * @param {function} callbacks.onTap - Called when tap is detected (x, y)
   * @param {function} callbacks.onDoubleTap - Called when double tap is detected (x, y)
   * @param {function} callbacks.onLongPress - Called when long press is detected (x, y)
   * @param {function} callbacks.onDragStart - Called when drag starts (x, y)
   * @param {function} callbacks.onDragMove - Called during drag (x, y, deltaX, deltaY)
   * @param {function} callbacks.onDragEnd - Called when drag ends (x, y)
   * @param {function} callbacks.onPinchStart - Called when pinch starts (center, distance)
   * @param {function} callbacks.onPinchMove - Called during pinch (center, distance, deltaDistance)
   * @param {function} callbacks.onPinchEnd - Called when pinch ends (center, distance)
   * @param {Object} options - Touch options
   * @param {number} options.tapThreshold - Maximum movement for tap detection (px, default: 10)
   * @param {number} options.tapTimeout - Maximum time for tap detection (ms, default: 200)
   * @param {number} options.doubleTapDelay - Maximum time between taps for double tap (ms, default: 300)
   * @param {number} options.longPressDelay - Minimum time for long press detection (ms, default: 500)
   * @returns {function} Function to remove event listeners
   */
  setupTouchControls: function(element, callbacks = {}, options = {}) {
    // Default options
    const settings = {
      tapThreshold: options.tapThreshold || 10, // px
      tapTimeout: options.tapTimeout || 200, // ms
      doubleTapDelay: options.doubleTapDelay || 300, // ms
      longPressDelay: options.longPressDelay || 500, // ms
    };
    
    // Touch state variables
    let isDragging = false;
    let isPinching = false;
    let startX = null;
    let startY = null;
    let lastX = null;
    let lastY = null;
    let tapTimeout = null;
    let longPressTimeout = null;
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;
    let pinchStartDistance = 0;
    let pinchCenter = { x: 0, y: 0 };
    
    // Detect iOS to handle platform-specific issues
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    // Normalize touch/mouse coordinates
    const getNormalizedCoords = (event) => {
      let x, y;
      const rect = element.getBoundingClientRect();
      
      // Handle both touch and mouse events
      if (event.touches) {
        if (event.touches.length === 0 && event.changedTouches && event.changedTouches.length > 0) {
          // Use changedTouches on touchend when touches array is empty
          x = event.changedTouches[0].clientX - rect.left;
          y = event.changedTouches[0].clientY - rect.top;
        } else {
          x = event.touches[0].clientX - rect.left;
          y = event.touches[0].clientY - rect.top;
        }
      } else {
        x = event.clientX - rect.left;
        y = event.clientY - rect.top;
      }
      
      // Normalize to 0-1 range
      x = Math.max(0, Math.min(1, x / rect.width));
      y = Math.max(0, Math.min(1, y / rect.height));
      
      return { x, y };
    };
    
    // Get pinch data from event
    const getPinchData = (event) => {
      if (event.touches.length < 2) return null;
      
      const rect = element.getBoundingClientRect();
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      // Calculate normalized center point
      const centerX = ((touch1.clientX + touch2.clientX) / 2 - rect.left) / rect.width;
      const centerY = ((touch1.clientY + touch2.clientY) / 2 - rect.top) / rect.height;
      
      // Calculate distance
      const deltaX = touch1.clientX - touch2.clientX;
      const deltaY = touch1.clientY - touch2.clientY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      return {
        center: { x: centerX, y: centerY },
        distance: distance
      };
    };
    
    // Start event (mousedown/touchstart)
    const handleStart = (event) => {
      // Only prevent default for touch to allow proper focusing of form elements
      if (event.touches) {
        if (!['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(event.target.tagName)) {
          event.preventDefault();
        }
      }
      
      // Clear any existing timeouts
      if (longPressTimeout) {
        clearTimeout(longPressTimeout);
        longPressTimeout = null;
      }
      
      // Handle multi-touch for pinch
      if (event.touches && event.touches.length === 2) {
        isPinching = true;
        const pinchData = getPinchData(event);
        
        pinchStartDistance = pinchData.distance;
        pinchCenter = pinchData.center;
        
        if (callbacks.onPinchStart) {
          callbacks.onPinchStart(pinchData.center, pinchData.distance);
        }
        
        return;
      }
      
      // Handle regular touch/mouse
      const { x, y } = getNormalizedCoords(event);
      
      startX = x;
      startY = y;
      lastX = x;
      lastY = y;
      
      // Set up tap timeout - will be cleared if movement exceeds threshold
      tapTimeout = setTimeout(() => {
        tapTimeout = null;
      }, settings.tapTimeout);
      
      // Set up long press timeout
      if (callbacks.onLongPress) {
        longPressTimeout = setTimeout(() => {
          longPressTimeout = null;
          
          // Only trigger if no significant movement
          const dist = Math.sqrt(
            Math.pow(x - startX, 2) + Math.pow(y - startY, 2)
          );
          
          if (dist < settings.tapThreshold / element.clientWidth) {
            callbacks.onLongPress(x, y);
          }
        }, settings.longPressDelay);
      }
      
      // Start drag
      if (callbacks.onDragStart) {
        callbacks.onDragStart(x, y);
      }
    };
    
    // Move event (mousemove/touchmove)
    const handleMove = (event) => {
      if (startX === null && !isPinching) return;
      
      // Prevent default mainly for iOS to prevent scrolling
      // But don't prevent on form elements
      if (!['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(event.target.tagName)) {
        event.preventDefault();
      }
      
      // Handle pinch
      if (isPinching && event.touches && event.touches.length === 2) {
        const pinchData = getPinchData(event);
        const deltaDistance = pinchData.distance - pinchStartDistance;
        
        if (callbacks.onPinchMove) {
          callbacks.onPinchMove(pinchData.center, pinchData.distance, deltaDistance);
        }
        
        pinchCenter = pinchData.center;
        return;
      }
      
      // Regular touch/mouse
      if (startX !== null) {
        const { x, y } = getNormalizedCoords(event);
        
        // Calculate delta from last position
        const deltaX = x - lastX;
        const deltaY = y - lastY;
        
        // Update last position
        lastX = x;
        lastY = y;
        
        // Calculate total movement
        const totalDeltaX = Math.abs(x - startX);
        const totalDeltaY = Math.abs(y - startY);
        const totalDelta = Math.sqrt(totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY);
        
        // If movement exceeds threshold, cancel tap and long press
        if (totalDelta > settings.tapThreshold / Math.min(element.clientWidth, element.clientHeight)) {
          if (tapTimeout) {
            clearTimeout(tapTimeout);
            tapTimeout = null;
          }
          
          if (longPressTimeout) {
            clearTimeout(longPressTimeout);
            longPressTimeout = null;
          }
          
          if (!isDragging) {
            isDragging = true;
          }
        }
        
        // Trigger drag move
        if (isDragging && callbacks.onDragMove) {
          callbacks.onDragMove(x, y, deltaX, deltaY);
        }
      }
    };
    
    // End event (mouseup/touchend)
    const handleEnd = (event) => {
      // Only prevent default for touch to allow proper interaction with form elements
      if (event.touches || event.changedTouches) {
        if (!['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(event.target.tagName)) {
          event.preventDefault();
        }
      }
      
      // Handle pinch end
      if (isPinching) {
        if (callbacks.onPinchEnd) {
          callbacks.onPinchEnd(pinchCenter, pinchStartDistance);
        }
        
        isPinching = false;
        return;
      }
      
      // Cleanup timeouts
      if (longPressTimeout) {
        clearTimeout(longPressTimeout);
        longPressTimeout = null;
      }
      
      // Get final position
      const { x, y } = startX !== null ? { x: lastX, y: lastY } : getNormalizedCoords(event);
      
      // Handle drag end
      if (isDragging && callbacks.onDragEnd) {
        callbacks.onDragEnd(x, y);
      } 
      // Handle tap
      else if (tapTimeout && startX !== null) {
        const now = Date.now();
        
        // Check for double tap
        if (callbacks.onDoubleTap && 
            now - lastTapTime < settings.doubleTapDelay &&
            Math.abs(x - lastTapX) < settings.tapThreshold / element.clientWidth &&
            Math.abs(y - lastTapY) < settings.tapThreshold / element.clientHeight) {
          
          callbacks.onDoubleTap(x, y);
          lastTapTime = 0; // Reset to prevent triple tap
        } 
        // Handle single tap
        else if (callbacks.onTap) {
          callbacks.onTap(x, y);
          
          // Store tap data for double tap detection
          lastTapTime = now;
          lastTapX = x;
          lastTapY = y;
        }
      }
      
      // Reset state
      if (tapTimeout) {
        clearTimeout(tapTimeout);
        tapTimeout = null;
      }
      
      isDragging = false;
      startX = null;
      startY = null;
    };
    
    // Cancel event (mouseleave/touchcancel)
    const handleCancel = () => {
      // Cleanup timeouts
      if (tapTimeout) {
        clearTimeout(tapTimeout);
        tapTimeout = null;
      }
      
      if (longPressTimeout) {
        clearTimeout(longPressTimeout);
        longPressTimeout = null;
      }
      
      // Reset state
      isDragging = false;
      isPinching = false;
      startX = null;
      startY = null;
    };
    
    // iOS Safari specific handler for touchforcechange (3D Touch)
    const handleForceTouch = (event) => {
      if (isIOS && event.touches && event.touches[0] && 
          typeof event.touches[0].force !== 'undefined' && 
          event.touches[0].force > 0.5 && callbacks.onLongPress) {
        
        // Cancel regular long press timeout
        if (longPressTimeout) {
          clearTimeout(longPressTimeout);
          longPressTimeout = null;
        }
        
        // Get position
        const { x, y } = getNormalizedCoords(event);
        
        // Trigger long press
        callbacks.onLongPress(x, y);
      }
    };
    
    // Add event listeners - handle both touch and mouse
    // Use passive: false to allow preventDefault() on iOS Safari
    element.addEventListener('touchstart', handleStart, { passive: false });
    element.addEventListener('touchmove', handleMove, { passive: false });
    element.addEventListener('touchend', handleEnd, { passive: false });
    element.addEventListener('touchcancel', handleCancel, { passive: false });
    
    // Add 3D Touch support for iOS
    if (isIOS) {
      element.addEventListener('touchforcechange', handleForceTouch, { passive: false });
    }
    
    // Mouse events
    element.addEventListener('mousedown', handleStart);
    element.addEventListener('mousemove', handleMove);
    element.addEventListener('mouseup', handleEnd);
    element.addEventListener('mouseleave', handleCancel);
    
    // Return function to remove listeners
    return function cleanup() {
      element.removeEventListener('touchstart', handleStart);
      element.removeEventListener('touchmove', handleMove);
      element.removeEventListener('touchend', handleEnd);
      element.removeEventListener('touchcancel', handleCancel);
      
      if (isIOS) {
        element.removeEventListener('touchforcechange', handleForceTouch);
      }
      
      element.removeEventListener('mousedown', handleStart);
      element.removeEventListener('mousemove', handleMove);
      element.removeEventListener('mouseup', handleEnd);
      element.removeEventListener('mouseleave', handleCancel);
    };
  },
  
  /**
   * Detects common gesture patterns from touch input
   * @param {Object} startPoint - Starting point {x, y}
   * @param {Object} endPoint - Ending point {x, y}
   * @param {Object} options - Detection options
   * @param {number} options.swipeThreshold - Min distance for swipe (default: 0.1 = 10% of screen)
   * @param {number} options.tapThreshold - Max distance for tap (default: 0.02 = 2% of screen)
   * @returns {Object} Detected gesture {type, direction, distance, angle}
   */
  detectGesture: function(startPoint, endPoint, options = {}) {
    const defaultOptions = {
      swipeThreshold: 0.1, // 10% of screen
      tapThreshold: 0.02    // 2% of screen
    };
    
    const settings = { ...defaultOptions, ...options };
    
    // Calculate distance and angle
    const deltaX = endPoint.x - startPoint.x;
    const deltaY = endPoint.y - startPoint.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    
    // Determine gesture type
    let type = 'unknown';
    let direction = null;
    
    if (distance < settings.tapThreshold) {
      type = 'tap';
    } else if (distance >= settings.swipeThreshold) {
      type = 'swipe';
      
      // Determine direction
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        // Vertical swipe
        direction = deltaY > 0 ? 'down' : 'up';
      }
    } else {
      type = 'move';
    }
    
    return {
      type,
      direction,
      distance,
      angle,
      deltaX,
      deltaY
    };
  },
  
  /**
   * Divides the screen into interactive touch zones
   * @param {Array} zones - Array of zone definitions
   * @param {string} zones[].id - Unique identifier for the zone
   * @param {Object} zones[].rect - Zone rectangle {x, y, width, height} in normalized 0-1 coordinates
   * @param {function} zones[].onTap - Callback when zone is tapped
   * @param {function} zones[].onDrag - Callback when drag occurs within zone
   * @param {HTMLElement} element - Element to attach zones to
   * @returns {Object} Zone controller with methods to update/remove zones
   */
  createTouchZones: function(zones, element) {
    const activeZones = [...zones];
    
    // Helper to determine if a point is within a zone
    const pointInZone = (x, y, zone) => {
      const { rect } = zone;
      return (
        x >= rect.x && 
        x <= rect.x + rect.width && 
        y >= rect.y && 
        y <= rect.y + rect.height
      );
    };
    
    // Set up touch controls
    const touchCleanup = this.setupTouchControls(element, {
      onTap: (x, y) => {
        // Find matching zones
        activeZones.forEach(zone => {
          if (pointInZone(x, y, zone) && typeof zone.onTap === 'function') {
            zone.onTap(x, y);
          }
        });
      },
      
      onDragStart: (x, y) => {
        // Track which zones the drag started in
        activeZones.forEach(zone => {
          zone._dragActive = pointInZone(x, y, zone);
          
          if (zone._dragActive && typeof zone.onDragStart === 'function') {
            zone.onDragStart(x, y);
          }
        });
      },
      
      onDragMove: (x, y, deltaX, deltaY) => {
        // Call drag handlers for active zones
        activeZones.forEach(zone => {
          if (zone._dragActive && typeof zone.onDrag === 'function') {
            zone.onDrag(x, y, deltaX, deltaY);
          }
        });
      },
      
      onDragEnd: (x, y) => {
        // End drag for active zones
        activeZones.forEach(zone => {
          if (zone._dragActive && typeof zone.onDragEnd === 'function') {
            zone.onDragEnd(x, y);
          }
          
          // Reset drag state
          zone._dragActive = false;
        });
      }
    });
    
    // Return controller
    return {
      /**
       * Adds a new touch zone
       * @param {Object} zone - Zone definition
       */
      addZone: function(zone) {
        activeZones.push(zone);
      },
      
      /**
       * Removes a touch zone by id
       * @param {string} id - Zone id to remove
       */
      removeZone: function(id) {
        const index = activeZones.findIndex(zone => zone.id === id);
        if (index !== -1) {
          activeZones.splice(index, 1);
        }
      },
      
      /**
       * Updates a zone's properties
       * @param {string} id - Zone id to update
       * @param {Object} props - New properties
       */
      updateZone: function(id, props) {
        const zone = activeZones.find(zone => zone.id === id);
        if (zone) {
          Object.assign(zone, props);
        }
      },
      
      /**
       * Gets all active zones
       * @returns {Array} Array of active zones
       */
      getZones: function() {
        return [...activeZones];
      },
      
      /**
       * Cleans up all event listeners
       */
      cleanup: function() {
        touchCleanup();
      }
    };
  },
  
  /**
   * Optimizes a Three.js geometry for better performance
   * @param {THREE.Mesh} mesh - Mesh to optimize
   * @param {Object} options - Optimization options
   * @param {number} options.detail - Level of detail (0-1, 1 is full detail)
   * @param {boolean} options.mergeVertices - Whether to merge vertices
   * @param {boolean} options.simplifyMesh - Whether to reduce polygon count
   * @returns {THREE.Mesh} Optimized mesh
   */
  optimizeGeometry: function(mesh, options = {}) {
    const defaultOptions = {
      detail: 0.5,
      mergeVertices: true,
      simplifyMesh: true
    };
    
    const settings = { ...defaultOptions, ...options };
    
    // Skip if not a mesh with geometry
    if (!mesh.geometry) {
      console.warn('Cannot optimize: not a valid mesh with geometry');
      return mesh;
    }
    
    // Create a clone to avoid modifying the original
    const optimizedMesh = mesh.clone();
    
    // Check if geometry is a buffer geometry (all geometries in recent Three.js versions)
    if (optimizedMesh.geometry.isBufferGeometry) {
      // Basic optimization: remove unused attributes
      const geometry = optimizedMesh.geometry;
      const material = optimizedMesh.material;
      
      // Dispose of unnecessary attributes
      if (geometry.attributes.color && (!material.vertexColors || material.vertexColors === false)) {
        geometry.deleteAttribute('color');
      }
      
      if (geometry.attributes.normal && material.flatShading) {
        geometry.deleteAttribute('normal');
      }
      
      if (geometry.attributes.uv2 && !material.lightMap && !material.aoMap) {
        geometry.deleteAttribute('uv2');
      }
      
      // Manual simplification if requested and detail < 1
      if (settings.simplifyMesh && settings.detail < 1) {
        try {
          // Check if SimplifyModifier exists in the global scope
          if (typeof THREE.SimplifyModifier !== 'undefined') {
            const simplifier = new THREE.SimplifyModifier();
            const count = Math.floor(geometry.attributes.position.count * (1 - settings.detail));
            optimizedMesh.geometry = simplifier.modify(geometry, count);
          } else {
            // Fallback: simple decimation by skipping vertices
            // This is a very basic approach, not suitable for production
            const positionAttr = geometry.attributes.position;
            const normalAttr = geometry.attributes.normal;
            const uvAttr = geometry.attributes.uv;
            
            // Only apply if we have enough vertices
            if (positionAttr && positionAttr.count > 100) {
              const skipFactor = Math.max(1, Math.floor(1 / settings.detail));
              
              // Create new smaller arrays for attributes
              const newPositions = [];
              const newNormals = [];
              const newUvs = [];
              
              // Sample attributes at regular intervals
              for (let i = 0; i < positionAttr.count; i += skipFactor) {
                for (let j = 0; j < 3; j++) {
                  newPositions.push(positionAttr.getX(i), positionAttr.getY(i), positionAttr.getZ(i));
                }
                
                if (normalAttr) {
                  newNormals.push(normalAttr.getX(i), normalAttr.getY(i), normalAttr.getZ(i));
                }
                
                if (uvAttr) {
                  newUvs.push(uvAttr.getX(i), uvAttr.getY(i));
                }
              }
              
              // Create new geometry with decimated data
              const newGeometry = new THREE.BufferGeometry();
              newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
              
              if (normalAttr) {
                newGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(newNormals, 3));
              }
              
              if (uvAttr) {
                newGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(newUvs, 2));
              }
              
              // Replace the old geometry
              optimizedMesh.geometry.dispose(); // Clean up
              optimizedMesh.geometry = newGeometry;
            }
          }
        } catch (e) {
          console.warn('Mesh simplification failed, using original geometry:', e);
        }
      }
      
      // Merge vertices if requested
      if (settings.mergeVertices) {
        try {
          // Check if BufferGeometryUtils exists in the global scope
          if (typeof THREE.BufferGeometryUtils !== 'undefined') {
            optimizedMesh.geometry = THREE.BufferGeometryUtils.mergeVertices(optimizedMesh.geometry);
          } else if (optimizedMesh.geometry.mergeVertices) {
            // Some versions have this method directly on geometry
            optimizedMesh.geometry.mergeVertices();
          }
        } catch (e) {
          console.warn('Vertex merging failed:', e);
        }
      }
    }
    
    // Compute bounding sphere for culling
    optimizedMesh.geometry.computeBoundingSphere();
    
    return optimizedMesh;
  },
  
  /**
   * Implements Level of Detail (LOD) for an object
   * @param {THREE.Object3D} baseObject - Base object
   * @param {Array} detailLevels - Array of {distance, object} pairs
   * @returns {THREE.LOD} LOD object
   */
  implementLOD: function(baseObject, detailLevels) {
    // Create LOD object
    const lod = new THREE.LOD();
    
    // Add original object as highest detail
    lod.addLevel(baseObject, 0);
    
    // Add additional detail levels
    detailLevels.forEach(level => {
      if (level.object && typeof level.distance === 'number') {
        lod.addLevel(level.object, level.distance);
      }
    });
    
    // Position LOD at original object position
    lod.position.copy(baseObject.position);
    
    return lod;
  },
  
  /**
   * Reduces update frequency for non-essential objects
   * @param {Array} objects - Array of objects to throttle
   * @param {Object} options - Throttling options
   * @param {number} options.updateFrequency - How often to update (frames, default: 2)
   * @param {number} options.distanceThreshold - Distance at which to reduce updates further
   * @param {THREE.Camera} options.camera - Camera for distance calculations
   * @returns {function} Update function to call in animation loop
   */
  throttleUpdates: function(objects, options = {}) {
    const defaultOptions = {
      updateFrequency: 2,
      distanceThreshold: 50,
      camera: null
    };
    
    const settings = { ...defaultOptions, ...options };
    
    // Track frame count
    let frameCount = 0;
    
    // Return update function
    return function update() {
      frameCount++;
      
      // Update objects based on frequency
      objects.forEach(obj => {
        // Get custom update frequency for this object
        const frequency = obj._updateFrequency || settings.updateFrequency;
        
        // Skip update if not on the right frame
        if (frameCount % frequency !== 0) {
          return;
        }
        
        // If camera provided, adjust frequency based on distance
        if (settings.camera && settings.distanceThreshold) {
          const distance = settings.camera.position.distanceTo(obj.position);
          
          // If beyond threshold, update less frequently
          if (distance > settings.distanceThreshold) {
            // Update every 2x frames for distant objects
            if (frameCount % (frequency * 2) !== 0) {
              return;
            }
          }
        }
        
        // Call update method if exists
        if (typeof obj.update === 'function') {
          obj.update();
        }
      });
    };
  },
  
  /**
   * Monitors frame rate and adjusts quality dynamically
   * @param {THREE.WebGLRenderer} renderer - Renderer to adjust
   * @param {Object} options - Monitoring options
   * @param {number} options.targetFPS - Target frame rate (default: 60)
   * @param {number} options.sampleSize - Frames to average (default: 60)
   * @param {Array} options.qualityLevels - Array of settings for each level
   * @returns {Object} Monitor controller with methods to adjust quality
   */
  monitorFramerate: function(renderer, options = {}) {
    const defaultOptions = {
      targetFPS: 60,
      sampleSize: 60,
      lowerThreshold: 0.8, // 80% of target
      higherThreshold: 0.95, // 95% of target
      qualityLevels: [
        // Lowest quality
        { pixelRatio: 0.5, shadows: false, antialias: false },
        // Medium quality
        { pixelRatio: 0.75, shadows: false, antialias: false },
        // High quality
        { pixelRatio: 1, shadows: true, antialias: false },
        // Ultra quality
        { pixelRatio: window.devicePixelRatio, shadows: true, antialias: true }
      ]
    };
    
    const settings = { ...defaultOptions, ...options };
    
    // Frame timing variables
    let frameTimes = [];
    let lastFrameTime = performance.now();
    let currentFPS = settings.targetFPS;
    let currentQualityLevel = 2; // Start at high quality
    
    // Apply quality settings
    const applyQuality = (level) => {
      const quality = settings.qualityLevels[level];
      if (!quality) return;
      
      // Apply settings to renderer
      renderer.setPixelRatio(quality.pixelRatio);
      renderer.shadowMap.enabled = quality.shadows;
      
      // Can't change antialias after creation, but record setting
      renderer._antialiasEnabled = quality.antialias;
      
      // Apply any custom settings from quality level
      if (typeof quality.apply === 'function') {
        quality.apply(renderer);
      }
      
      currentQualityLevel = level;
    };
    
    // Apply initial quality
    applyQuality(currentQualityLevel);
    
    // Return monitor controller
    return {
      /**
       * Update function to call each frame
       */
      update: function() {
        const now = performance.now();
        const frameTime = now - lastFrameTime;
        lastFrameTime = now;
        
        // Calculate FPS
        const instantFPS = 1000 / frameTime;
        
        // Add to samples
        frameTimes.push(frameTime);
        
        // Keep sample size fixed
        if (frameTimes.length > settings.sampleSize) {
          frameTimes.shift();
        }
        
        // Calculate average FPS
        const averageFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
        currentFPS = 1000 / averageFrameTime;
        
        // Adjust quality if needed
        const lowerThreshold = settings.targetFPS * settings.lowerThreshold;
        const higherThreshold = settings.targetFPS * settings.higherThreshold;
        
        if (currentFPS < lowerThreshold && currentQualityLevel > 0) {
          // Lower quality
          applyQuality(currentQualityLevel - 1);
        } else if (currentFPS > higherThreshold && currentQualityLevel < settings.qualityLevels.length - 1) {
          // Higher quality
          applyQuality(currentQualityLevel + 1);
        }
      },
      
      /**
       * Get current FPS and quality metrics
       * @returns {Object} Performance metrics
       */
      getMetrics: function() {
        return {
          currentFPS,
          targetFPS: settings.targetFPS,
          qualityLevel: currentQualityLevel,
          qualityName: ['Low', 'Medium', 'High', 'Ultra'][currentQualityLevel]
        };
      },
      
      /**
       * Manually set quality level
       * @param {number} level - Quality level index
       */
      setQualityLevel: function(level) {
        if (level >= 0 && level < settings.qualityLevels.length) {
          applyQuality(level);
        }
      }
    };
  },
  
  /**
   * Creates an object pool for reusing instances
   * @param {function} objectFactory - Function that creates new objects
   * @param {number} initialSize - Initial number of objects to create
   * @param {function} resetObject - Function to reset object to initial state
   * @returns {Object} Pool controller with get/release methods
   */
  createObjectPool: function(objectFactory, initialSize, resetObject) {
    const pool = [];
    const active = new Set();
    
    // Create initial objects
    for (let i = 0; i < initialSize; i++) {
      pool.push(objectFactory());
    }
    
    return {
      /**
       * Get an object from the pool
       * @returns {Object} Pooled object
       */
      get: function() {
        let object;
        
        // Get from pool or create new
        if (pool.length > 0) {
          object = pool.pop();
        } else {
          object = objectFactory();
        }
        
        // Track as active
        active.add(object);
        
        return object;
      },
      
      /**
       * Release an object back to the pool
       * @param {Object} object - Object to release
       */
      release: function(object) {
        // Skip if not active
        if (!active.has(object)) {
          return;
        }
        
        // Reset if function provided
        if (typeof resetObject === 'function') {
          resetObject(object);
        }
        
        // Remove from active and add to pool
        active.delete(object);
        pool.push(object);
      },
      
      /**
       * Release all active objects
       */
      releaseAll: function() {
        active.forEach(object => {
          this.release(object);
        });
      },
      
      /**
       * Get counts of available and active objects
       * @returns {Object} Pool stats
       */
      getStats: function() {
        return {
          available: pool.length,
          active: active.size,
          total: pool.length + active.size
        };
      }
    };
  },
  
  /**
   * Unloads assets that are outside the camera frustum
   * @param {Array} objects - Objects to manage
   * @param {THREE.Camera} camera - Camera for frustum checking
   * @param {Object} options - Unloading options
   * @param {number} options.margin - Extra distance beyond frustum (default: 10)
   * @param {boolean} options.unloadGeometry - Whether to dispose geometry
   * @param {boolean} options.unloadTextures - Whether to dispose textures
   * @returns {function} Update function to call each frame
   */
  unloadOffscreenAssets: function(objects, camera, options = {}) {
    const defaultOptions = {
      margin: 10,
      unloadGeometry: false,
      unloadTextures: true
    };
    
    const settings = { ...defaultOptions, ...options };
    
    // Track frustum state
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    
    // Track loaded state
    const loadedState = new Map();
    
    // Update function
    return function update() {
      // Calculate current frustum
      projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projScreenMatrix);
      
      // Check each object
      objects.forEach(obj => {
        // Skip if no geometry or bounding sphere
        if (!obj.geometry || !obj.geometry.boundingSphere) {
          return;
        }
        
        // Create world bounding sphere
        const boundingSphere = obj.geometry.boundingSphere.clone();
        boundingSphere.radius += settings.margin;
        
        // Transform to world space
        obj.updateMatrixWorld();
        const center = boundingSphere.center.clone().applyMatrix4(obj.matrixWorld);
        const worldBoundingSphere = new THREE.Sphere(center, boundingSphere.radius);
        
        // Check if in frustum
        const inFrustum = frustum.intersectsSphere(worldBoundingSphere);
        
        // Get current loaded state
        const prevLoaded = loadedState.get(obj) !== false;
        
        if (inFrustum && !prevLoaded) {
          // Load assets
          if (settings.unloadGeometry && obj._originalGeometry) {
            obj.geometry = obj._originalGeometry;
            delete obj._originalGeometry;
          }
          
          if (settings.unloadTextures && obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((mat, i) => {
                if (mat._originalTextures) {
                  Object.entries(mat._originalTextures).forEach(([prop, texture]) => {
                    mat[prop] = texture;
                  });
                  delete mat._originalTextures;
                }
              });
            } else if (obj.material._originalTextures) {
              Object.entries(obj.material._originalTextures).forEach(([prop, texture]) => {
                obj.material[prop] = texture;
              });
              delete obj.material._originalTextures;
            }
          }
          
          loadedState.set(obj, true);
        } else if (!inFrustum && prevLoaded) {
          // Unload assets
          if (settings.unloadGeometry) {
            obj._originalGeometry = obj.geometry;
            
            // Replace with simplified version
            const simpleGeometry = new THREE.BufferGeometry();
            obj.geometry = simpleGeometry;
          }
          
          if (settings.unloadTextures && obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(mat => {
                const textures = {};
                
                // Save and remove textures
                for (const prop in mat) {
                  if (mat[prop] && mat[prop].isTexture) {
                    textures[prop] = mat[prop];
                    mat[prop] = null;
                  }
                }
                
                mat._originalTextures = textures;
              });
            } else {
              const textures = {};
              
              // Save and remove textures
              for (const prop in obj.material) {
                if (obj.material[prop] && obj.material[prop].isTexture) {
                  textures[prop] = obj.material[prop];
                  obj.material[prop] = null;
                }
              }
              
              obj.material._originalTextures = textures;
            }
          }
          
          loadedState.set(obj, false);
        }
      });
    };
  },
  
  /**
   * Helper to manage Three.js objects and memory
   * @param {Object} options - Memory management options
   * @param {number} options.interval - How often to dispose unused objects (ms)
   * @param {function} options.beforeCleanup - Function to call before disposing objects
   * @returns {Object} Memory manager with methods to track and dispose objects
   */
  memoryManager: function(options = {}) {
    const defaultOptions = {
      interval: 30000, // 30 seconds
      beforeCleanup: null
    };
    
    const settings = { ...defaultOptions, ...options };
    
    // Keep track of objects to dispose
    const tracked = {
      geometries: new Set(),
      materials: new Set(),
      textures: new Set(),
      renderTargets: new Set(),
      scenes: new Set(),
      meshes: new Set(),
      other: new Set(),
      unused: new Set() // Objects marked as no longer needed
    };
    
    let intervalId = null;
    
    // Helper to safely dispose an object based on its type
    const safeDispose = (obj) => {
      if (!obj) return;
      
      try {
        // Different objects have different disposal methods
        if (obj.dispose && typeof obj.dispose === 'function') {
          // Most Three.js objects have a dispose method
          obj.dispose();
        } else if (obj.geometry && obj.geometry.dispose) {
          // Handle meshes - need to dispose geometry and material
          obj.geometry.dispose();
          
          // Material might be an array
          if (Array.isArray(obj.material)) {
            obj.material.forEach(mat => {
              if (mat && mat.dispose) mat.dispose();
            });
          } else if (obj.material && obj.material.dispose) {
            obj.material.dispose();
          }
        }
      } catch (e) {
        console.warn('Error disposing object:', e);
      }
    };
    
    // Cleanup function - called periodically
    const cleanup = () => {
      // Call before cleanup hook if provided
      if (typeof settings.beforeCleanup === 'function') {
        settings.beforeCleanup();
      }
      
      // First dispose unused objects
      tracked.unused.forEach(obj => {
        safeDispose(obj);
      });
      tracked.unused.clear();
      
      // Debug log (optional)
      if (window.performance && window.performance.memory) {
        const memory = window.performance.memory;
        console.debug(`Memory usage: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
      }
    };
    
    // Start automatic cleanup
    const startInterval = () => {
      if (intervalId) return;
      
      intervalId = setInterval(cleanup, settings.interval);
    };
    
    // Stop automatic cleanup
    const stopInterval = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    
    // Start interval
    startInterval();
    
    return {
      /**
       * Track Three.js object for later disposal
       * @param {Object} object - Object to track
       * @param {string} [type] - Object type (auto-detected if not specified)
       * @returns {Object} The tracked object
       */
      track: function(object, type) {
        if (!object) return object;
        
        // Auto-detect type if not specified
        if (!type) {
          if (object.isGeometry || object.isBufferGeometry) {
            type = 'geometry';
          } else if (object.isMaterial || object.isMaterialArray) {
            type = 'material';
          } else if (object.isTexture) {
            type = 'texture';
          } else if (object.isWebGLRenderTarget) {
            type = 'renderTarget';
          } else if (object.isScene) {
            type = 'scene';
          } else if (object.isMesh || object.isLine || object.isPoints) {
            type = 'mesh';
          } else {
            type = 'other';
          }
        }
        
        // Add to appropriate set
        const targetSet = tracked[type + 's'] || tracked.other;
        targetSet.add(object);
        
        return object;
      },
      
      /**
       * Mark object as no longer needed and ready for disposal
       * @param {Object} object - Object to dispose
       * @param {boolean} [immediate=false] - Whether to dispose immediately
       */
      dispose: function(object, immediate = false) {
        if (!object) return;
        
        // Remove from tracking sets
        for (const key in tracked) {
          tracked[key].delete(object);
        }
        
        if (immediate) {
          safeDispose(object);
        } else {
          tracked.unused.add(object);
        }
      },
      
      /**
       * Release all tracked objects of a specific type
       * @param {string} type - Type of objects to release ('all' for everything)
       * @param {boolean} [dispose=true] - Whether to dispose objects
       */
      releaseByType: function(type, dispose = true) {
        if (type === 'all') {
          // Release all types
          for (const key in tracked) {
            if (key === 'unused') continue;
            
            if (dispose) {
              tracked[key].forEach(obj => {
                safeDispose(obj);
              });
            }
            tracked[key].clear();
          }
        } else {
          // Release specific type
          const targetSet = tracked[type + 's'] || tracked[type];
          
          if (targetSet) {
            if (dispose) {
              targetSet.forEach(obj => {
                safeDispose(obj);
              });
            }
            targetSet.clear();
          }
        }
      },
      
      /**
       * Dispose all resources associated with a scene
       * @param {THREE.Scene} scene - Scene to dispose
       */
      disposeScene: function(scene) {
        if (!scene) return;
        
        // Traverse the scene and dispose all objects
        scene.traverse(object => {
          if (object.geometry) {
            this.dispose(object.geometry, true);
          }
          
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => {
                this.dispose(material, true);
              });
            } else {
              this.dispose(object.material, true);
            }
          }
          
          // Remove from scene
          if (object.parent) {
            object.parent.remove(object);
          }
        });
        
        // Clear the scene
        while (scene.children.length > 0) {
          scene.remove(scene.children[0]);
        }
        
        // Force a cleanup
        cleanup();
      },
      
      /**
       * Force immediate cleanup
       */
      forceCleanup: cleanup,
      
      /**
       * Stop automatic cleanup
       */
      stopAutomaticCleanup: stopInterval,
      
      /**
       * Start automatic cleanup
       */
      startAutomaticCleanup: startInterval,
      
      /**
       * Get current memory statistics
       * @returns {Object|null} Memory stats or null if not supported
       */
      getMemoryStats: function() {
        // Return count of tracked objects
        const counts = {};
        for (const key in tracked) {
          counts[key] = tracked[key].size;
        }
        
        // Add performance memory info if available
        if (window.performance && window.performance.memory) {
          const memory = window.performance.memory;
          counts.memory = {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit,
            percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
          };
        }
        
        return counts;
      }
    };
  },
  
  /**
   * Creates a debounced function that delays invoking func until after wait milliseconds
   * @param {function} func - Function to debounce
   * @param {number} wait - Milliseconds to wait
   * @param {boolean} immediate - Whether to call immediately
   * @returns {function} Debounced function
   */
  debounceFunction: function(func, wait, immediate = false) {
    let timeout;
    
    return function executedFunction(...args) {
      const context = this;
      
      const later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      
      const callNow = immediate && !timeout;
      
      clearTimeout(timeout);
      
      timeout = setTimeout(later, wait);
      
      if (callNow) func.apply(context, args);
    };
  },
  
  /**
   * Generates a UUID (v4)
   * @returns {string} UUID
   */
  generateUUID: function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },
  
  /**
   * Saves game state data efficiently
   * @param {Object} data - Game state to save
   * @param {string} key - Storage key
   * @param {Object} options - Save options
   * @param {boolean} options.compress - Whether to compress data
   * @param {boolean} options.useLocalStorage - Whether to use localStorage
   * @returns {boolean} Success status
   */
  saveGameState: function(data, key, options = {}) {
    const defaultOptions = {
      compress: true,
      useLocalStorage: true
    };
    
    const settings = { ...defaultOptions, ...options };
    
    try {
      // Convert data to string
      let stringData = JSON.stringify(data);
      
      // Compress if requested
      if (settings.compress) {
        // Simple compression by replacing common patterns
        // Note: For real compression, use a library like LZString
        const patterns = [
          { pattern: '{"', replacement: '~o' },
          { pattern: ':[', replacement: ':a' },
          { pattern: 'true', replacement: '!t' },
          { pattern: 'false', replacement: '!f' },
          { pattern: 'null', replacement: '!n' }
        ];
        
        patterns.forEach(({ pattern, replacement }) => {
          stringData = stringData.split(pattern).join(replacement);
        });
        
        // Add compression marker
        stringData = 'C' + stringData;
      } else {
        // Mark as uncompressed
        stringData = 'U' + stringData;
      }
      
      // Save to storage
      if (settings.useLocalStorage) {
        localStorage.setItem(key, stringData);
      } else {
        // Use sessionStorage as fallback
        sessionStorage.setItem(key, stringData);
      }
      
      return true;
    } catch (e) {
      console.error('Error saving game state:', e);
      return false;
    }
  },
  
  /**
   * Loads game state data
   * @param {string} key - Storage key
   * @param {Object} options - Load options
   * @param {boolean} options.useLocalStorage - Whether to use localStorage
   * @returns {Object|null} Game state or null if not found
   */
  loadGameState: function(key, options = {}) {
    const defaultOptions = {
      useLocalStorage: true
    };
    
    const settings = { ...defaultOptions, ...options };
    
    try {
      // Get from storage
      const storage = settings.useLocalStorage ? localStorage : sessionStorage;
      const stringData = storage.getItem(key);
      
      // Return null if not found
      if (!stringData) {
        return null;
      }
      
      // Check compression flag
      const isCompressed = stringData[0] === 'C';
      let dataString = stringData.substring(1);
      
      // Decompress if needed
      if (isCompressed) {
        // Reverse compression
        const patterns = [
          { pattern: '~o', replacement: '{"' },
          { pattern: ':a', replacement: ':[' },
          { pattern: '!t', replacement: 'true' },
          { pattern: '!f', replacement: 'false' },
          { pattern: '!n', replacement: 'null' }
        ];
        
        patterns.forEach(({ pattern, replacement }) => {
          dataString = dataString.split(pattern).join(replacement);
        });
      }
      
      // Parse JSON
      return JSON.parse(dataString);
    } catch (e) {
      console.error('Error loading game state:', e);
      return null;
    }
  }
};

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MobileGameLib;
}