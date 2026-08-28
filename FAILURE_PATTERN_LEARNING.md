# SeeMind v0.63.1 — Failure Pattern Learning

## Purpose
Turn benchmark mistakes into structured experience without training a large model on the phone and without creating a second brain.

## Previous gap
Benchmark sessions retained aggregate quality, success and latency. They did not reliably preserve the scene conditions/tags needed to answer:
- Does this engine fail mainly in low light?
- Is blur the problem?
- Is shop noise worse than quiet speech?
- Are numbers/model names a recurring ASR weakness?

A high-level score could tell SeeMind that an engine was weaker, but not why.

## Change
Benchmark rows now preserve case:
- tags
- conditions
- scenario
- category
- language

A Failure Pattern Analyzer aggregates weak cases per engine and identifies evidence-backed patterns.

Vision patterns currently include:
- low light
- blur
- far distance
- multiple objects
- small target
- text interference
- occlusion

Voice patterns currently include:
- shop/street/vehicle noise
- far microphone
- mixed language
- numbers/amounts
- brand/model terms

## Remediation hints
Repeated patterns can generate bounded routing/tuning hints, such as:
- crop/zoom before heavier vision for distant/small targets
- preserve universal vision as primary when text is only interference
- require confirmation for low-margin numbers
- prefer a promoted noise-robust ASR when enough evidence exists

These hints are advisory evidence. They do not automatically retrain, install, promote, or invoke an external AI.

## Learning philosophy
SeeMind's practical local learning is:
observe failures -> classify failure modes -> adjust routing/tuning -> benchmark again -> promote only after proof.

It is not:
one mistake -> rewrite the whole system
or
phone trains a giant model.
