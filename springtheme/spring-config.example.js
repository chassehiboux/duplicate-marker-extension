/* Черновой пример конфига для PyramidNewYear.
 * Файл показываю как ориентир, подключать в прод после согласования.
 */
(function () {
  window.PYRAMID_THEME_CONFIG = Object.freeze({
    toggles: {
      showNewYearToggle: true,
      showSpringToggle: true
    },
    behavior: {
      allowThemeOverlap: false,
      defaultTheme: "none" // "none" | "newyear" | "spring"
    },
    spring: {
      defaultVariant: "a", // "a" | "b" | "c"
      petalsEnabled: true,
      maxPetals: 18
    }
  });
})();

