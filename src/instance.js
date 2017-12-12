import "./defaults.js";

export default class Instance {
  constructor(element, id, options) {
    this.timeouts = [];
    this.id = id;
    this.queue = [];
    this.queueIndex = 0;
    this.hasStarted = false;
    this.isPaused = false;
    this.inTag = false;
    this.stringsToDelete = "";
    this.style =
      'style="display:inline;position:relative;font:inherit;color:inherit;"';
    this.element = element;

    this.setOptions(options, window.TypeItDefaults, false);
    this.init();
  }

  init() {
    this.checkElement();

    this.options.strings = this.toArray(this.options.strings);
    this.options.strings = this.removeComments(this.options.strings);

    //-- We don't have anything. Get out of here.
    if (this.options.strings.length >= 1 && this.options.strings[0] === "") {
      return;
    }

    this.element.innerHTML =
      '<i class="ti-placeholder" style="display:inline-block;width:0;line-height:0;overflow:hidden;">.</i><span ' +
      this.style +
      ' class="ti-container"></span>';

    this.element.setAttribute("data-typeitid", this.id);
    this.elementContainer = this.element.querySelector("span");

    if (this.options.startDelete) {
      this.insert(this.stringsToDelete);
      this.queue.push([this.delete]);
      this.insertPauseIntoQueue(1);
    }

    this.generateQueue();
    this.kickoff();
  }

  removeComments(arrayOfStrings) {
    return arrayOfStrings.map(string => {
      return string.replace(/<\!--.*?-->/g, "");
    });
  }

  generateQueue() {
    this.options.strings.forEach((string, index) => {

      this.queueUpString(string);

      //-- This is not the last string, so insert a pause for between strings.
      if (index + 1 < this.options.strings.length) {
        this.queue.push([this.options.breakLines ? this.break : this.delete]);
        this.insertPauseIntoQueue(this.queue.length);
      }

    });
  }

  /**
   * Add steps to the queue for each character in a given string.
   */
  queueUpString(string, rake = true) {
    string = this.toArray(string);

    //-- If it's designated, rake that bad boy for HTML tags and stuff.
    if (rake) {
      string = this.rake(string);
      string = string[0];
    }

    //-- Randomize the timeout each time, if that's your thing.
    this.setPace(this);

    //-- If an opening HTML tag is found and we're not already printing inside a tag
    if (
      this.options.html &&
      (string[0].indexOf("<") !== -1 && string[0].indexOf("</") === -1)
    ) {

      //-- Create node of that string name.
      let matches = string[0].match(/\<(.*?)\>/);
      let doc = document.implementation.createHTMLDocument();
      doc.body.innerHTML = "<" + matches[1] + "></" + matches[1] + ">";

      //-- Add to the queue.
      this.queue.push([this.type, doc.body.children[0]]);

    } else {
      this.queue.push([this.type, string[0]]);
    }

    //-- Shorten it by one character.
    string.splice(0, 1);

    //-- If there's more to it, run again until fully printed.
    if (string.length) {
      this.queueUpString(string, false);
    }
  }

  insertPauseIntoQueue(position) {
    let halfDelay = this.options.nextStringDelay / 2;
    this.queue.splice(position - 1, 0, [this.pause, halfDelay]);
    this.queue.splice(position + 2, 0, [this.pause, halfDelay]);
  }

  kickoff() {
    this.cursor();

    if (this.options.autoStart) {
      this.startQueue();
    } else {
      if (this.isVisible()) {
        this.hasStarted = true;
        this.startQueue();
      } else {
        let that = this;

        window.addEventListener("scroll", function checkForStart(event) {
          if (that.isVisible() && !that.hasStarted) {
            that.hasStarted = true;
            that.startQueue();
            event.currentTarget.removeEventListener(event.type, checkForStart);
          }
        });
      }
    }
  }

  startQueue() {
    setTimeout(() => {
      this.next();
    }, this.options.startDelay);
  }

  isVisible() {
    let coordinates = this.element.getBoundingClientRect();

    let viewport = {
      height:
        window.innerHeight ||
        document.documentElement.clientHeight ||
        document.body.clientHeight,
      width:
        window.innerWidth ||
        document.documentElement.clientWidth ||
        document.body.clientWidth
    };

    //-- Element extends outside of viewport.
    if (
      coordinates.right > viewport.width ||
      coordinates.bottom > viewport.height
    ) {
      return false;
    }

    //-- Top or left aren't visible.
    if (coordinates.top < 0 || coordinates.left < 0) {
      return false;
    }

    return true;
  }

  cursor() {
    if (!this.options.cursor) return;

    let styleBlock = document.createElement("style");

    styleBlock.id = this.id;

    let styles = `
          @keyframes blink-${this.id} {
            0% {opacity: 0}
            49%{opacity: 0}
            50% {opacity: 1}
          }

          [data-typeitid='${this.id}'] .ti-cursor {
            animation: blink-${this.id} ${this.options.cursorSpeed /
      1000}s infinite;
          }
        `;

    styleBlock.appendChild(document.createTextNode(styles));

    document.head.appendChild(styleBlock);

    this.element.insertAdjacentHTML(
      "beforeend",
      "<span " + this.style + 'class="ti-cursor">|</span>'
    );
  }

  /**
   * Appends string to element container.
   */
  insert(content, toChildNode = false) {

    if (toChildNode) {
      this.elementContainer.lastChild.insertAdjacentHTML("beforeend", content);
    } else {
      this.elementContainer.insertAdjacentHTML("beforeend", content);
    }

    //-- Split & rejoin to avoid odd spacing issues in some browsers.
    this.elementContainer.innerHTML = this.elementContainer.innerHTML
      .split("")
      .join("");
  }

  /**
   * Converts a string to an array, if it's not already.
   *
   * @return array
   */
  toArray(string) {
    return string.constructor === Array
      ? string.slice(0)
      : string.split("<br>");
  }

  /**
   * Depending on if we're starting by deleting an existing string or typing
   * from nothing, set a specific variable to what's in the HTML.
   */
  checkElement() {
    if (!this.options.startDelete && this.element.innerHTML.length > 0) {
      this.options.strings = this.element.innerHTML.trim();
    } else {
      this.stringsToDelete = this.element.innerHTML;
    }
  }

  break() {
    this.insert("<br>");
    this.next();
  }

  pause(time) {
    setTimeout(() => {
      this.next();
    }, time === undefined ? this.options.nextStringDelay : time);
  }

  /*
    Convert each string in the array to a sub-array. While happening, search the subarrays for HTML tags.
    When a complete tag is found, slice the subarray to get the complete tag, insert it at the correct index,
    and delete the range of indexes where the indexed tag used to be.
  */
  rake(array) {
    return array.map(item => {

      //-- Convert string to array.
      item = item.split("");

      //-- If we're parsing HTML, group tags into their own array items.
      if (this.options.html) {
        let tPosition = [];
        let tag;
        let isEntity = false;

        for (let j = 0; j < item.length; j++) {
          if (item[j] === "<" || item[j] === "&") {
            tPosition[0] = j;
            isEntity = item[j] === "&";
          }

          if (item[j] === ">" || (item[j] === ";" && isEntity)) {
            tPosition[1] = j;
            j = 0;
            tag = item.slice(tPosition[0], tPosition[1] + 1).join("");
            item.splice(tPosition[0], tPosition[1] - tPosition[0] + 1, tag);
            isEntity = false;
          }
        }
      }

      return item;
    });
  }

  print(character) {

    //-- We must have an HTML tag!
    if(typeof character !== 'string') {
      this.elementContainer.appendChild(character);
      this.inTag = true;
      return;
    }

    if(character.startsWith('</')) {
      this.inTag = false;
    }

    this.insert(character, this.inTag);
  }

  type(character) {
    this.timeouts[0] = setTimeout(() => {
      this.print(character);
      this.next();
    }, this.typePace);
  }

  /**
   * Removes helper elements with certain classes from the TypeIt element.
   */
  removeHelperElements() {
    let helperElements = this.element.querySelectorAll(
      ".ti-container, .ti-cursor, .ti-placeholder"
    );

    [].forEach.call(helperElements, helperElement => {
      this.element.removeChild(helperElement);
    });
  }

  setOptions(settings, defaults = null, autonext = true) {
    let mergedSettings = {};

    if (defaults === null) {
      defaults = this.options;
    }

    for (let attrname in defaults) {
      mergedSettings[attrname] = defaults[attrname];
    }

    for (let attrname in settings) {
      mergedSettings[attrname] = settings[attrname];
    }

    this.options = mergedSettings;

    if (autonext) {
      this.next();
    }
  }

  randomInRange(value, range) {
    return Math.abs(
      Math.random() * (value + range - (value - range)) + (value - range)
    );
  }

  setPace() {
    let typeSpeed = this.options.speed;
    let deleteSpeed =
      this.options.deleteSpeed !== undefined
        ? this.options.deleteSpeed
        : this.options.speed / 3;
    let typeRange = typeSpeed / 2;
    let deleteRange = deleteSpeed / 2;

    this.typePace = this.options.lifeLike
      ? this.randomInRange(typeSpeed, typeRange)
      : typeSpeed;
    this.deletePace = this.options.lifeLike
      ? this.randomInRange(deleteSpeed, deleteRange)
      : deleteSpeed;
  }

  delete(chars = null) {
    this.timeouts[1] = setTimeout(() => {
      this.setPace();

      let textArray = this.elementContainer.innerHTML.split("");

      let amount = chars === null ? textArray.length - 1 : chars + 1;

      //-- Cut the array by a character.
      for (let n = textArray.length - 1; n > -1; n--) {
        if (
          (textArray[n] === ">" || textArray[n] === ";") &&
          this.options.html
        ) {
          for (let o = n; o > -1; o--) {
            if (textArray.slice(o - 3, o + 1).join("") === "<br>") {
              textArray.splice(o - 3, 4);
              break;
            }

            if (textArray[o] === "&") {
              textArray.splice(o, n - o + 1);
              break;
            }

            if (textArray[o] === "<") {
              if (textArray[o - 1] !== ">") {
                if (textArray[o - 1] === ";") {
                  for (var p = o - 1; p > -1; p--) {
                    if (textArray[p] === "&") {
                      textArray.splice(p, o - p);
                      break;
                    }
                  }
                }

                textArray.splice(o - 1, 1);
                break;
              }
            }
          }
          break;
        } else {
          textArray.pop();
          break;
        }
      }

      //-- If we've found an empty set of HTML tags...
      if (this.elementContainer.innerHTML.indexOf("></") > -1) {
        for (
          let i = this.elementContainer.innerHTML.indexOf("></") - 2;
          i >= 0;
          i--
        ) {
          if (textArray[i] === "<") {
            textArray.splice(i, textArray.length - i);
            break;
          }
        }
      }

      this.elementContainer.innerHTML = textArray.join("");

      //-- Characters still in the string.
      if (amount > (chars === null ? 0 : 2)) {
        this.delete(chars === null ? null : chars - 1);
      } else {
        this.next();
      }
    }, this.deletePace);
  }

  /*
    Empty the existing text, clearing it instantly.
  */
  empty() {
    this.elementContainer.innerHTML = "";
    this.next();
  }

  next() {

    // if(this.isPaused) {
    //   console.log('paused!');
    //   return;
    // }

    if (this.queueIndex < this.queue.length) {
      let thisFunc = this.queue[this.queueIndex];
      this.queueIndex++;

      //-- Delay execution if looping back to the beginning of the queue.
      if (this.isLooping && this.queueIndex === 1) {
        setTimeout(() => {
          thisFunc[0].call(this, thisFunc[1]);
        }, this.options.loopDelay / 2);
      } else {
        thisFunc[0].call(this, thisFunc[1]);
      }

      return;
    }

    this.options.callback();

    if (this.options.loop) {
      this.queueIndex = 0;
      this.isLooping = true;
      setTimeout(() => {
        this.delete();
      }, this.options.loopDelay / 2);
    }
  }
}
