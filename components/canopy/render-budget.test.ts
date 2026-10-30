import { test } from "node:test"
import assert from "node:assert/strict"
import { RenderBudget } from "./render-budget"

test("expensive frames leave an idle gap measured from completion, including startup", () => {
  const budget = new RenderBudget()
  budget.observe(2300, 2400)
  assert.equal(budget.ready(2401), false)
  assert.equal(budget.ready(3899), false)
  assert.equal(budget.ready(3900), true)
})

test("delayed frame delivery reduces quality even when draw submission is fast", () => {
  const budget = new RenderBudget()
  budget.observe(2, 100)
  budget.delivered(1000)
  assert.equal(budget.quality, .5)
  assert.equal(budget.interval, 1500)
  assert.equal(budget.ready(1001), false)
  budget.delivered(1017)
  assert.equal(budget.quality, .5, "idle RAF callbacks must not count as another expensive frame")
})

test("adaptive sampling advances animation in real time but excludes hidden intervals", () => {
  const budget = new RenderBudget()
  assert.equal(budget.animationDelta(1000), 0)
  assert.equal(budget.animationDelta(2500), 1.5)
  budget.resetAnimation()
  assert.equal(budget.animationDelta(100000), 0)
  assert.equal(budget.animationDelta(100500), .5)
})

test("fast devices retain Canopy quality and its quiet 24fps ceiling", () => {
  const budget = new RenderBudget()
  budget.observe(12)
  assert.equal(budget.quality, 1)
  assert.equal(budget.interval, 1000 / 24)
})

test("slow drawing sheds pixel cost and leaves breathing room for input", () => {
  const budget = new RenderBudget()
  budget.observe(2300)
  assert.equal(budget.quality, .5)
  assert.equal(budget.interval, 1500)
  budget.observe(250)
  assert.equal(budget.quality, .35)
  assert.equal(budget.interval, 625)
})

test("quality stays bounded without oscillating after transient fast frames", () => {
  const budget = new RenderBudget()
  for (let i = 0; i < 10; i++) budget.observe(1000)
  assert.equal(budget.quality, .35)
  budget.observe(10)
  assert.equal(budget.quality, .35)
  assert.equal(budget.interval, 1000 / 24)
})
