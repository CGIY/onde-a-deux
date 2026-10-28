/* Shared Paris-time windows for seasonal announcements and decorations. */
(() => {
  "use strict";
  const announcementStart = Date.parse("2026-10-01T00:00:00+02:00");
  const halloween = Object.freeze({
    start: Date.parse("2026-10-27T00:00:00+02:00"),
    end: Date.parse("2026-11-02T00:00:00+01:00"),
    label: "27 oct.–1 nov. · 10 exclusives"
  });
  window.SeasonDates = Object.freeze({
    announcementStart,
    halloween,
    birthday: Object.freeze({start: announcementStart, end: Date.parse("2026-11-09T00:00:00+01:00")}),
    christmas: Object.freeze({start: announcementStart, end: Date.parse("2026-12-26T00:00:00+01:00")})
  });
})();
