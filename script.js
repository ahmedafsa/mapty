"use strict";

/////////////////////////////////////////
// CODE

class Workout {
  date = new Date();
  id = (Date.now() + "").slice(-10);

  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat , lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // prettier-ignore
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = "running";

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;

    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // pace in min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = "cycling";

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);

    this.elevationGain = elevationGain;

    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // speed in km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

/////////////////////////////////////////
// Application

const form = document.querySelector(".form");
const containerWorkouts = document.querySelector(".workouts");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputCadence = document.querySelector(".form__input--cadence");
const inputElevation = document.querySelector(".form__input--elevation");

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];

  constructor() {
    // Get user position
    this._getPosition();

    // Get data from locale storage
    this._getLocaleStorage();

    ///////////////////////////////
    // ---- Event Listeners

    // Show the form field on any click on the map
    form.addEventListener("submit", this._newWorkout.bind(this));

    // change the Elevation field for Running and Cycling
    inputType.addEventListener("change", this._toggleElevationField.bind(this));

    // Move to the workout coords at click
    containerWorkouts.addEventListener("click", this._moveToPop.bind(this));
  }

  _getPosition() {
    navigator.geolocation.getCurrentPosition(
      this._loadMap.bind(this),
      function () {
        alert("Couldn't get your position");
      }
    );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map("map").setView(coords, this.#mapZoomLevel);

    L.tileLayer("https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this.#map.on("click", this._showForm.bind(this));

    // Render locale storage workouts markers
    this.#workouts.forEach(workout => {
      this._renderWorkoutMarker(workout);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove("hidden");
    inputDistance.focus();
  }

  _hideForm() {
    // empty inputs
    inputDuration.value =
      inputDistance.value =
      inputCadence.value =
      inputElevation.value =
        "";
    if (inputType.value === "cycling") {
      inputType.value = "running";
      this._toggleElevationField();
    }

    // Hide the form
    form.style.display = "none";
    form.classList.add("hidden");
    setTimeout(() => {
      form.style.display = "grid";
    }, 1000);
  }

  _toggleElevationField() {
    inputElevation.closest(".form__row").classList.toggle("form__row--hidden");
    inputCadence.closest(".form__row").classList.toggle("form__row--hidden");
  }

  _newWorkout(e) {
    // Inputs checking function
    const validInputs = (...inputs) =>
      inputs.every(input => Number.isFinite(input));

    const isAllPositive = (...inputs) => inputs.every(input => input > 0);

    e.preventDefault();

    // Get data from the form
    const workoutType = inputType.value; // String
    const distance = +inputDistance.value; // Number
    const duration = +inputDuration.value; // Number
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // Check if workout is Running and create Running Object
    if (workoutType === "running") {
      const cadence = +inputCadence.value;

      // check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !isAllPositive(distance, duration, cadence)
      )
        return alert("Cadence must be positive number!");

      // Create a Running Object
      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // Check if workout is Cycling and create Cycling Object
    if (workoutType === "cycling") {
      const elevation = +inputElevation.value;

      // check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !isAllPositive(distance, duration)
      )
        return alert("Cadence must be positive number!");

      // Create a Cycling Object
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // push the Workout Object into the workouts Array (whatever it's Running or Cycling )
    this.#workouts.push(workout);

    // Render workout on the map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on the list
    this._renderWorkoutList(workout);
    // Clear Form Input Fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocaleStorage();
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkoutList(workout) {
    const html = `
          <li class="workout workout--${workout.type}" data-id="${workout.id}">
              <h2 class="workout__title">${workout.description}</h2>
              <div class="workout__details">
                <span class="workout__icon">${
                  workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"
                }</span>
                <span class="workout__value">${workout.distance}</span>
                <span class="workout__unit">km</span>
              </div>
              <div class="workout__details">
                <span class="workout__icon">⏱</span>
                <span class="workout__value">${workout.duration}</span>
                <span class="workout__unit">min</span>
              </div>
              <div class="workout__details">
                <span class="workout__icon">⚡️</span>
                <span class="workout__value">${(workout.type === "running"
                  ? workout.pace
                  : workout.speed
                ).toFixed(1)}</span>
                <span class="workout__unit">${
                  workout.type === "running" ? "min/km" : "km/h"
                }</span>
              </div>
              <div class="workout__details">
                <span class="workout__icon">${
                  workout.type === "running" ? "🦶🏼" : "⛰"
                }</span>
                <span class="workout__value">${
                  workout.type === "running"
                    ? workout.cadence
                    : workout.elevationGain
                }</span>
                <span class="workout__unit">${
                  workout.type === "running" ? "spm" : "m"
                }</span>
              </div>
            </li>
      `;

    form.insertAdjacentHTML("afterend", html);
  }

  _moveToPop(e) {
    const workoutEl = e.target.closest(".workout");

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      workout => workout.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });

    //using the Public Interface
    // workout.click();
  }

  _setLocaleStorage() {
    localStorage.setItem("workouts", JSON.stringify(this.#workouts));
  }

  _getLocaleStorage() {
    const data = JSON.parse(localStorage.getItem("workouts"));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(workout => {
      this._renderWorkoutList(workout);
    });
  }

  sort() {}

  reset() {
    localStorage.removeItem("workouts");
    location.reload();
  }
}

const app = new App();
