"use strict";

/////////////////////////////////////////
// CODE

class Workout {
  date = new Date();
  id = (Date.now() + "").slice(-10);

  clicks = 0;

  constructor(coords, distance, duration, title, location, temperature) {
    this.title = title;
    this.coords = coords; // [lat , lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
    this.location = location;
    this.temperature = temperature;
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // prettier-ignore
    this.description = `${this.type} on ${months[this.date.getMonth()]} ${this.date.getDate()} - ${(this.date.getHours() + '').padStart(2,'0')}:${(this.date.getMinutes()+ '').padStart(2,'0')}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = "running";

  constructor(
    coords,
    distance,
    duration,
    title,
    cadence,
    location,
    temperature
  ) {
    super(coords, distance, duration, title, location, temperature);
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

  constructor(
    coords,
    distance,
    duration,
    title,
    elevationGain,
    location,
    temperature
  ) {
    super(coords, distance, duration, title, location, temperature);

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

const form = document.querySelector(".form--add");
const containerWorkouts = document.querySelector(".workouts");
const inputTitle = document.querySelector(".form__input--title");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputCadence = document.querySelector(".form__input--cadence");
const inputElevation = document.querySelector(".form__input--elevation");

const selectFilter = document.querySelector(".setting__select--filter");
const selectSort = document.querySelector(".setting__select--sort");

const workoutEditButton = document.querySelector(".setting__workout--edit");
const workoutDeleteButton = document.querySelector(".setting__workout--delete");

const deleteAllWorkoutsButton = document.querySelector(
  ".setting__delete--workouts"
);

const warnContainer = document.querySelector(".warn__message");
const warnTitle = document.querySelector(".warn__message--title");
const warnContent = document.querySelector(".warn__message--content");
const warnClose = document.querySelector(".warn__message--close");

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];

  // v2.0 properties
  #markers = [];

  #filterWorkouts = [];
  #submitHandler;
  #editWorkoutEl;
  #markupsGroup;

  constructor() {
    // Get user position
    this._getPosition();

    // Get data from locale storage
    this._getLocaleStorage();

    // Make sure to reset the form input fields at start
    this._hideForm();

    ///////////////////////////////
    // ---- Event Listeners

    this.#submitHandler = this._newWorkout.bind(this);

    // Create new workout on submitting the form
    form.addEventListener("submit", this.#submitHandler);

    // change the Elevation field for Running and Cycling
    inputType.addEventListener("change", this._toggleElevationField.bind(this));

    // Move to the workout coords at click
    containerWorkouts.addEventListener("click", this._moveToPop.bind(this));

    // Filter the workout
    selectFilter.addEventListener("change", this.filter.bind(this));

    // Sort the workout
    selectSort.addEventListener("change", this.sort.bind(this));

    // Delete all Workouts
    deleteAllWorkoutsButton.addEventListener(
      "click",
      this._deleteAll.bind(this)
    );

    // Show Edit Workout Form
    containerWorkouts.addEventListener("click", this._showEditForm.bind(this));

    // Delete a Workout
    containerWorkouts.addEventListener("click", this._deleteWorkout.bind(this));
  }

  _getPosition() {
    navigator.geolocation.getCurrentPosition(
      this._loadMap.bind(this),
      this._warn.bind(
        this,
        "Location Access Error",
        "To use this application, please enable location services on your device."
      )
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
      inputTitle.value =
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

  async _newWorkout(e) {
    e.preventDefault();

    // Get data from the form
    const title = inputTitle.value;
    const workoutType = inputType.value; // String
    const distance = +inputDistance.value; // Number
    const duration = +inputDuration.value; // Number
    const { lat, lng } = this.#mapEvent.latlng;
    const temperature = await this._setTemperature(lat, lng);
    const location = await this._setLocation(lat, lng);
    let workout;

    // Check if workout is Running and create Running Object
    if (workoutType === "running") {
      const cadence = +inputCadence.value;

      // check if data is valid
      if (!this._areInputsValid(distance, duration, cadence) || !title) {
        this._warn(
          "Invalid Inputs",
          "Positive numbers are required for (distance, duration, and cadence). Please double-check your entries."
        );
        return;
      }

      // Create a Running Object
      workout = new Running(
        [lat, lng],
        distance,
        duration,
        title,
        cadence,
        location,
        temperature
      );
    }

    // Check if workout is Cycling and create Cycling Object
    if (workoutType === "cycling") {
      const elevation = +inputElevation.value;

      // check if data is valid
      if (!this._areInputsValid(distance, duration, elevation) || !title) {
        this._warn(
          "Invalid Inputs",
          "Positive numbers are required for (distance, duration, and elevation). Please double-check your entries."
        );
        return;
      }

      // Create a Cycling Object
      workout = new Cycling(
        [lat, lng],
        distance,
        duration,
        title,
        elevation,
        location,
        temperature
      );
    }

    // push the Workout Object into the workouts Array (whatever it's Running or Cycling )
    this.#workouts.push(workout);

    // Render workout on the map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on the list
    this._renderWorkoutList(workout);

    // Clear Form Input Fields
    this._hideForm();

    // Apply filter
    this.filter();

    // Apply Sort
    this.sort();

    // Set local storage to all workouts
    this._setLocaleStorage();
  }

  _areInputsValid(...inputs) {
    const validInputs = inputs => inputs.every(input => Number.isFinite(input));

    const isAllPositive = inputs => inputs.every(input => input > 0);
    return validInputs(inputs) && isAllPositive(inputs);
  }

  _renderWorkoutMarker(workout) {
    this.#markupsGroup = L.layerGroup().addTo(this.#map);
    const marker = L.marker(workout.coords)
      .addTo(this.#markupsGroup)
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
        `${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${workout.title}`
      )
      .openPopup();

    marker.id = workout.id;
    this.#markers.push(marker);
  }

  _renderWorkoutList(workout) {
    const html = `
          <li class="workout workout--${workout.type}" data-id="${workout.id}">
          <div class="settings__workout">
            <button class="setting__workout setting__workout--edit">
              <ion-icon name="create"></ion-icon>
            </button>
            <button class="setting__workout setting__workout--delete">
              <ion-icon name="close"></ion-icon>
            </button>
          </div>

              <h2 class="workout__title">${workout.title}</h2>
              <h3 class="workout__sub">${workout.description}</h3>

              <div class="workout__details workout__location">
            <span class="workout__icon">🌏</span>
            <p class="workout__value">${workout.location.city}, ${
      workout.location.country
    }</p>
          </div>
          <div class="workout__details workout__weather">
            <span class="workout__icon">🌡️</span>
            <p class="workout__value">${workout.temperature}</p>
            <span class="workout__unit">°C</span>
          </div>

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

    containerWorkouts.insertAdjacentHTML("afterbegin", html);
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
    workout.click();
    this._setLocaleStorage();
  }

  _setLocaleStorage() {
    localStorage.setItem("workouts", JSON.stringify(this.#workouts));
  }

  _getLocaleStorage() {
    const data = JSON.parse(localStorage.getItem("workouts"));

    if (!data) return;
    data.forEach(workout => {
      if (workout.type === "running") {
        workout.__proto__ = Object.create(Running.prototype);
      } else {
        workout.__proto__ = Object.create(Cycling.prototype);
      }
    });
    this.#workouts = data;
    this.#workouts.forEach(workout => {
      this._renderWorkoutList(workout);
    });

    this.sort();
    this.filter();
  }

  // V 2.0
  filter() {
    containerWorkouts.innerHTML = "";

    if (selectFilter.value === "all") {
      this.#filterWorkouts = this.#workouts.slice();
      this.#filterWorkouts.forEach(workout => this._renderWorkoutList(workout));
    }

    if (selectFilter.value === "running") {
      this.#filterWorkouts = this.#workouts
        .slice()
        .filter(workout => workout.type === "running");
      this.#filterWorkouts.forEach(workout => this._renderWorkoutList(workout));
    }

    if (selectFilter.value === "cycling") {
      this.#filterWorkouts = this.#workouts
        .slice()
        .filter(workout => workout.type === "cycling");
      this.#filterWorkouts.forEach(workout => this._renderWorkoutList(workout));
    }

    // Sort the results after filtering it
    this.sort();
  }

  sort() {
    containerWorkouts.innerHTML = "";

    if (selectSort.value === "added") {
      this.#filterWorkouts.forEach(workout => this._renderWorkoutList(workout));
    }

    if (selectSort.value === "distance") {
      const sortedWorkouts = this.#filterWorkouts
        .slice()
        .sort((a, b) => a.distance - b.distance);

      sortedWorkouts.forEach(workout => this._renderWorkoutList(workout));
    }

    if (selectSort.value === "duration") {
      const sortedWorkouts = this.#filterWorkouts
        .slice()
        .sort((a, b) => a.duration - b.duration);

      sortedWorkouts.forEach(workout => this._renderWorkoutList(workout));
    }
  }

  _removeSubmitHandler() {
    form.removeEventListener("submit", this.#submitHandler);
  }

  _addSubmitHandler(handler) {
    this.#submitHandler = handler.bind(this);
    form.addEventListener("submit", this.#submitHandler);
  }

  _showEditForm(e) {
    if (!e.target.closest(".setting__workout--edit")) return;
    const workoutEl = this.#workouts.find(
      workout => workout.id === e.target.closest(".workout").dataset.id
    );
    form.classList.remove("hidden");
    inputTitle.value = workoutEl.title;
    inputDistance.value = workoutEl.distance;
    inputDuration.value = workoutEl.duration;
    inputType.value = workoutEl.type;
    if (workoutEl.type === "running") {
      if (
        inputCadence
          .closest(".form__row")
          .classList.contains("form__row--hidden")
      )
        this._toggleElevationField();
      inputCadence.value = workoutEl.cadence;
    }
    if (workoutEl.type === "cycling") {
      if (
        inputElevation
          .closest(".form__row")
          .classList.contains("form__row--hidden")
      )
        this._toggleElevationField();
      inputElevation.value = workoutEl.elevationGain;
    }
    inputDistance.focus();

    // Remove the current submit handler
    this._removeSubmitHandler();

    // Add a new submit handler for editing workouts
    this._addSubmitHandler(this._editWorkout);
    this.#editWorkoutEl = workoutEl;
  }

  _editWorkout(e) {
    e.preventDefault();

    const workoutEl = this.#editWorkoutEl;
    workoutEl.title = inputTitle.value;
    workoutEl.distance = inputDistance.value;
    workoutEl.duration = inputDuration.value;
    workoutEl.type = inputType.value;

    if (inputType.value === "running") {
      workoutEl.__proto__ = Object.create(Running.prototype);
      workoutEl.cadence = inputCadence.value;
      workoutEl.calcPace();
    } else {
      workoutEl.__proto__ = Object.create(Cycling.prototype);
      workoutEl.elevationGain = inputElevation.value;
      workoutEl.calcSpeed();
    }

    this.filter();
    this.sort();
    this._removeMarker(workoutEl);
    this._renderWorkoutMarker(workoutEl);

    this._setLocaleStorage();

    this._hideForm();
    this._removeSubmitHandler();
    this._addSubmitHandler(this._newWorkout.bind(this));
  }

  _deleteWorkout(e) {
    if (!e.target.closest(".setting__workout--delete")) return;

    const workoutEl = this.#workouts.find(
      workout => workout.id === e.target.closest(".workout").dataset.id
    );

    const index = this.#workouts.findIndex(
      workout => workout.id === workoutEl.id
    );
    this.#workouts.splice(index, 1);
    this._removeMarker(workoutEl);

    this.filter();
    this.sort();
    this._setLocaleStorage();
  }

  _deleteAll() {
    localStorage.removeItem("workouts");
    location.reload();

    this._hideForm();
  }

  _removeMarker(workout) {
    const marker = this.#markers.find(marker => marker.id === workout.id);
    marker.remove();
  }

  _warn(title, message) {
    let timer;
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      warnContainer.classList.add("hidden");
    }, 5000);

    warnContainer.classList.remove("hidden");

    warnTitle.textContent = title;
    warnContent.textContent = message;

    warnClose.addEventListener("click", function () {
      warnContainer.classList.add("hidden");
      clearTimeout(timer);
    });
  }

  // V 3.0

  async _setTemperature(lat, lng) {
    const weatherResp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m`
    );
    if (!weatherResp.ok) throw new Error("Error in loading the temperature");

    const weatherObj = await weatherResp.json();

    const temperature = weatherObj.current.temperature_2m;

    return temperature;
  }

  async _setLocation(lat, lng) {
    const locationResp = await fetch(
      `https://geocode.xyz/${lat},${lng}?geoit=json&auth=296899087781017106572x6374`
    );

    if (!locationResp.ok)
      throw new Error("Error in loading the Geocode country data");

    const countryObj = await locationResp.json();
    const country = countryObj.prov === "IL" ? "PS" : countryObj.prov;
    const city = countryObj.city;
    return { country, city };
  }
}

const app = new App();
