const { TAU } = require('../maths/constants')

// wrap any finite angle into [0, TAU), leaving non-negative angles exactly as angle % TAU
const wrapAngle = (angle) => {
  const wrapped = angle % TAU
  if (wrapped >= 0) return wrapped
  const shifted = wrapped + TAU
  // a tiny negative remainder can round up to TAU
  return shifted < TAU ? shifted : 0
}

module.exports = wrapAngle
