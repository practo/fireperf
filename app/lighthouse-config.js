module.exports = {
  "passes": [{
    "passName": "defaultPass",
    "recordNetwork": true,
    "recordTrace": true,
    "pauseBeforeTraceEndMs": 500,
    "useThrottling": true,
    "gatherers": [
      "url"
    ]
  },
  {
      "passName": "dbw",
      "recordNetwork": true,
      "useThrottling": false,
      "gatherers": [
        "dobetterweb/domstats",
        "dobetterweb/optimized-images"
      ]
    }
  ],
  "audits": [
    "first-meaningful-paint",
    "speed-index-metric",
    "time-to-interactive",
    "byte-efficiency/total-byte-weight",
    "dobetterweb/dom-size"
  ]
}
