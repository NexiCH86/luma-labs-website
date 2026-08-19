# LuMa RADAR SAT workspace enhancements

- Adds a manual observer location entry for systems where browser geolocation times out or is unavailable.
- Manual latitude/longitude and optional altitude are persisted locally in the browser.
- Applying a manual position feeds the existing Phase 2 observer calculations and Phase 3 solar/pass intelligence through the same location flow.
- Converts the right SAT details/tracked panel into a movable overlay so it no longer consumes or clips the map column.
- Drag the panel by the `SAT LIVE · DRAG` header. Double-click that header to reset the panel to the default right-side position.
- The dragged panel position is persisted locally in the browser.
