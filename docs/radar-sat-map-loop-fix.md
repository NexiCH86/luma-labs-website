# LuMa RADAR SAT map lifecycle fix

The SAT map must be initialized exactly once per page mount. Satellite records, observer data and selections are kept in refs so one-second marker updates do not change the Leaflet initialization effect dependencies.

A tile-error fallback to OpenStreetMap is included if CARTO tiles fail to load.
