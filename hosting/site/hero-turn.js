// The landing hero's Emberwatch turn, shared by the page and the capture.
window.FM_HERO_TURN = {
  action: "I check under the adventurers' back table.",
  narration: "You crouch beside the back table, where the boards are sticky with old beer. Wedged between two planks is a torn page, folded small and stained dark at the edges.\n\nWenna Tallow leans over the bar, ladle in hand. \"That'll be the map those three left before they went up to the barrow,\" she says. \"Didn't come back for it. Didn't come back at all.\"\n\nYou smooth the page flat. In charcoal and spilled beer, someone has drawn the mound's mouth, a hall of shields, and a long stair ending at a door marked with a cross.",
  choices: [
    'I ask Wenna who the three adventurers were.',
    'I buy a drink and study the map by the fire.',
    'I head for the barrow before dark.',
  ],
  stats: [
    { name: 'Faith', change: -4 },
    { name: 'Renown', change: 5 },
  ],
  newItem: 'Beer-Stained Barrow Map',
};
