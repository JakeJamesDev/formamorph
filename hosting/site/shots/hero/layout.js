// Written by scripts/captureSiteShots.mjs --only hero.
window.FM_HERO_LAYOUT = {
 "size": {
  "w": 1600,
  "h": 900
 },
 "colors": {
  "light": {
   "text": "rgb(19, 11, 30)",
   "dialogue": "rgb(106, 52, 178)",
   "action": "rgb(112, 96, 133)",
   "choice": "rgb(19, 11, 30)",
   "value": "rgb(19, 11, 30)",
   "fill": "rgb(195, 172, 226)",
   "descriptor": "rgb(112, 96, 133)",
   "success": "hsl(142 71% 40%)",
   "destructive": "hsl(0 84.2% 60.2%)"
  },
  "dark": {
   "text": "rgb(245, 243, 247)",
   "dialogue": "rgb(194, 162, 235)",
   "action": "rgb(171, 159, 188)",
   "choice": "rgb(245, 243, 247)",
   "value": "rgb(245, 243, 247)",
   "fill": "rgb(206, 188, 230)",
   "descriptor": "rgb(171, 159, 188)",
   "success": "hsl(142 65% 45%)",
   "destructive": "hsl(0 72% 58%)"
  }
 },
 "action": {
  "box": {
   "x": 469,
   "y": 85,
   "w": 665,
   "h": 20
  },
  "font": {
   "family": "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
   "size": 14,
   "line": 20,
   "weight": "400"
  }
 },
 "narration": {
  "box": {
   "x": 455,
   "y": 117,
   "w": 679,
   "h": 176
  },
  "font": {
   "family": "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
   "size": 16,
   "line": 24,
   "weight": "400"
  },
  "paragraphs": [
   {
    "x": 455,
    "y": 117,
    "w": 679,
    "h": 48
   },
   {
    "x": 455,
    "y": 181,
    "w": 679,
    "h": 48
   },
   {
    "x": 455,
    "y": 245,
    "w": 679,
    "h": 48
   }
  ]
 },
 "choices": [
  {
   "text": "I ask Wenna who the three adventurers were.",
   "row": {
    "x": 441,
    "y": 368,
    "w": 707,
    "h": 40
   },
   "box": {
    "x": 453,
    "y": 377,
    "w": 329.796875,
    "h": 22
   },
   "font": {
    "family": "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
    "size": 16,
    "line": 24,
    "weight": "400"
   }
  },
  {
   "text": "I buy a drink and study the map by the fire.",
   "row": {
    "x": 441,
    "y": 408,
    "w": 707,
    "h": 41
   },
   "box": {
    "x": 453,
    "y": 418,
    "w": 315.953125,
    "h": 22
   },
   "font": {
    "family": "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
    "size": 16,
    "line": 24,
    "weight": "400"
   }
  },
  {
   "text": "I head for the barrow before dark.",
   "row": {
    "x": 441,
    "y": 449,
    "w": 707,
    "h": 41
   },
   "box": {
    "x": 453,
    "y": 459,
    "w": 248.125,
    "h": 22
   },
   "font": {
    "family": "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
    "size": 16,
    "line": 24,
    "weight": "400"
   }
  }
 ],
 "stats": [
  {
   "name": "Health",
   "min": 0,
   "max": 100,
   "start": 100,
   "startDescriptor": "Hale. Whole and ready.",
   "valueText": "100 / 100",
   "value": {
    "x": 1492.5625,
    "y": 223,
    "w": 69.4375,
    "h": 24
   },
   "valueFont": {
    "family": "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif, sans-serif",
    "size": 16,
    "line": 24,
    "weight": "400"
   },
   "bar": {
    "x": 1203,
    "y": 247,
    "w": 359,
    "h": 16
   },
   "descriptor": "Hale. Whole and ready.",
   "descriptorBox": {
    "x": 1203,
    "y": 263,
    "w": 359,
    "h": 16
   },
   "descriptorFont": {
    "family": "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif, sans-serif",
    "size": 12,
    "line": 16,
    "weight": "400"
   }
  },
  {
   "name": "Mana",
   "min": 0,
   "max": 100,
   "start": 50,
   "startDescriptor": "Steady. Enough power for a fight's worth of magic.",
   "valueText": "50 / 100",
   "value": {
    "x": 1501.53125,
    "y": 287,
    "w": 60.46875,
    "h": 24
   },
   "valueFont": {
    "family": "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif, sans-serif",
    "size": 16,
    "line": 24,
    "weight": "400"
   },
   "bar": {
    "x": 1203,
    "y": 311,
    "w": 359,
    "h": 16
   },
   "descriptor": "Steady. Enough power for a fight's worth of magic.",
   "descriptorBox": {
    "x": 1203,
    "y": 327,
    "w": 359,
    "h": 16
   },
   "descriptorFont": {
    "family": "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif, sans-serif",
    "size": 12,
    "line": 16,
    "weight": "400"
   }
  },
  {
   "name": "Faith",
   "min": 0,
   "max": 100,
   "start": 50,
   "startDescriptor": "Steady. The Ember listens.",
   "end": 46,
   "endDescriptor": "Steady. The Ember listens.",
   "valueText": "50 / 100",
   "value": {
    "x": 1501.53125,
    "y": 351,
    "w": 60.46875,
    "h": 24
   },
   "valueFont": {
    "family": "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif, sans-serif",
    "size": 16,
    "line": 24,
    "weight": "400"
   },
   "bar": {
    "x": 1203,
    "y": 375,
    "w": 359,
    "h": 16
   },
   "descriptor": "Steady. The Ember listens.",
   "descriptorBox": {
    "x": 1203,
    "y": 391,
    "w": 359,
    "h": 16
   },
   "descriptorFont": {
    "family": "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif, sans-serif",
    "size": 12,
    "line": 16,
    "weight": "400"
   }
  },
  {
   "name": "Renown",
   "min": 0,
   "max": 100,
   "start": 5,
   "startDescriptor": "Unknown. One more face on the frontier road.",
   "end": 10,
   "endDescriptor": "Unknown. One more face on the frontier road.",
   "valueText": "5 / 100",
   "value": {
    "x": 1510.5,
    "y": 415,
    "w": 51.5,
    "h": 24
   },
   "valueFont": {
    "family": "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif, sans-serif",
    "size": 16,
    "line": 24,
    "weight": "400"
   },
   "bar": {
    "x": 1203,
    "y": 439,
    "w": 359,
    "h": 16
   },
   "descriptor": "Unknown. One more face on the frontier road.",
   "descriptorBox": {
    "x": 1203,
    "y": 455,
    "w": 359,
    "h": 16
   },
   "descriptorFont": {
    "family": "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif, sans-serif",
    "size": 12,
    "line": 16,
    "weight": "400"
   }
  }
 ],
 "panel": {
  "x": 1192,
  "y": 56,
  "w": 392,
  "h": 828
 },
 "newItem": {
  "x": 1203,
  "y": 651,
  "w": 359,
  "h": 36
 }
};
