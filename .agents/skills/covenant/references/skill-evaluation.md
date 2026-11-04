# Skill behavior evaluation

Gates check the form of a skill or instruction. They do not show that a change alters what an agent does. Run this evaluation when a change to a skill, an instruction file or a prompt claims to change agent behavior, and a wrong claim would cost more than the runs.

## Design

1. State the change under test and the observable behavior that counts as success. Write three to six concrete criteria for the judge. Do not show them to the candidates.
2. Prepare one working directory for each run, outside the checkout under evaluation. Install the baseline or the changed version, and add the context that a real task would have, such as a project skeleton and the skills that an agent would read.
3. Write one prompt that a user would type for this task. State the goal; do not describe the experiment.
4. Run the baseline and the changed version with the same prompt, model and effort. Run each version at least three times, because one run cannot separate the change from the variation between runs.
5. Give all outputs to one judge in one pass, scored on one scale. Label each output with a neutral identifier, and do not tell the judge which version produced it. Use a judge from a different model family when one is available, and record it when the judge shares the candidates' family.
6. Grade whether a run followed the instructions from its transcript and its output: the files it opened, the commands it ran and the shape of the result. Do not grade from the agent's own description of what it applied. Read only the transcripts of the evaluation runs.
7. Read every output yourself and compare your reading with the judge's scores. A disagreement shows an ambiguous criterion or a biased judge: fix the criterion and score again.

## Blinding

- Keep the words “eval”, “test”, “judge”, “rubric”, “score”, “benchmark”, “candidate” and “compare” out of every directory name, file name and prompt that a run can see.
- Use directory names that a user would choose for the task.
- Do not ask a run to list the skills, rules or files that it applied.
- Do not tell a run that other runs exist.

## Report

Report the change under test, the criteria, the number of runs for each version, notes for each run, the judge's scores, your own reading and a recommendation to keep or revert the change. State the limits that affect the conclusion, such as a judge from the same model family or a small number of runs. Record the result in the Agent Note for the change.
