/**
 * Bot implementation for the Prisoner's Dilemma game
 */

/**
 * Make a decision for the bot based on the game history.
 * This implements a simple strategy called "Tit for Tat" where the bot
 * copies the player's previous move, but starts with cooperation.
 *
 * @param {Array} playerHistory - Array of player's previous actions
 * @param {Array} botHistory - Array of bot's previous actions
 * @returns {string} - "Cooperate" or "Defect"
 */
function make_bot_decision(playerHistory, botHistory) {
  // If this is the first round, cooperate
  if (!playerHistory || playerHistory.length === 0) {
    return "Cooperate"
  }

  // Otherwise, do what the player did in the previous round (Tit for Tat)
  return playerHistory[playerHistory.length - 1]
}

export default make_bot_decision
