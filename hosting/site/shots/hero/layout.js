// Written by scripts/captureSiteShots.mjs --only hero.
window.FM_HERO_LAYOUT = {
 "size": {
  "w": 1600,
  "h": 900
 },
 "colors": {
  "light": {
   "text": "rgb(26, 29, 35)",
   "dialogue": "rgb(72, 89, 122)",
   "action": "rgb(106, 112, 124)",
   "choice": "rgb(26, 29, 35)",
   "value": "rgb(26, 29, 35)",
   "fill": "rgb(39, 44, 52)",
   "descriptor": "rgb(106, 112, 124)",
   "success": "hsl(142 71% 40%)",
   "destructive": "hsl(0 84.2% 60.2%)"
  },
  "dark": {
   "text": "rgb(244, 244, 246)",
   "dialogue": "rgb(175, 184, 202)",
   "action": "rgb(161, 166, 175)",
   "choice": "rgb(244, 244, 246)",
   "value": "rgb(244, 244, 246)",
   "fill": "rgb(233, 234, 237)",
   "descriptor": "rgb(161, 166, 175)",
   "success": "hsl(142 65% 45%)",
   "destructive": "hsl(0 72% 58%)"
  }
 },
 "action": {
  "box": {
   "x": 469,
   "y": 61,
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
   "y": 93,
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
    "y": 93,
    "w": 679,
    "h": 48
   },
   {
    "x": 455,
    "y": 157,
    "w": 679,
    "h": 48
   },
   {
    "x": 455,
    "y": 221,
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
    "y": 344,
    "w": 707,
    "h": 40
   },
   "box": {
    "x": 453,
    "y": 353,
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
    "y": 384,
    "w": 707,
    "h": 41
   },
   "box": {
    "x": 453,
    "y": 394,
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
    "y": 425,
    "w": 707,
    "h": 41
   },
   "box": {
    "x": 453,
    "y": 435,
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
