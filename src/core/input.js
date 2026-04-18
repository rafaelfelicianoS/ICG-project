export class InputController {
  constructor(targetElement) {
    this.targetElement = targetElement;
    this.keysDown = {};
    this.keyPressed = {};
    this.mouseDown = false;
    this.mousePressed = false;
    this.mouseReleased = false;

    this.onKeyDown = (event) => {
      if (!this.keysDown[event.code]) {
        this.keyPressed[event.code] = true;
      }
      this.keysDown[event.code] = true;
    };

    this.onKeyUp = (event) => {
      this.keysDown[event.code] = false;
    };

    this.onMouseDown = (event) => {
      if (event.button !== 0) {
        return;
      }
      if (!this.mouseDown) {
        this.mousePressed = true;
      }
      this.mouseDown = true;
    };

    this.onMouseUp = (event) => {
      if (event.button !== 0) {
        return;
      }
      this.mouseDown = false;
      this.mouseReleased = true;
    };

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.targetElement.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
  }

  isDown(code) {
    return !!this.keysDown[code];
  }

  wasKeyPressed(code) {
    if (!this.keyPressed[code]) {
      return false;
    }
    this.keyPressed[code] = false;
    return true;
  }

  isPointerDown() {
    return this.mouseDown;
  }

  wasPointerPressed() {
    if (!this.mousePressed) {
      return false;
    }
    this.mousePressed = false;
    return true;
  }

  wasPointerReleased() {
    if (!this.mouseReleased) {
      return false;
    }
    this.mouseReleased = false;
    return true;
  }

  endFrame() {
    this.mousePressed = false;
    this.mouseReleased = false;
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.targetElement.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
  }
}
