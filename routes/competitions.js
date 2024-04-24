const express = require("express");
const router = express.Router();
const { authRequired, adminRequired } = require("../services/auth.js");
const Joi = require("joi");
const { db } = require("../services/db.js");

// GET /competitions
router.get("/", authRequired, function (req, res, next) {
  const stmt = db.prepare(`
        SELECT c.id, c.name, c.description, c.team_size, u.name AS author, c.apply_till
        FROM competitions c, users u
        WHERE c.author_id = u.id
        ORDER BY c.apply_till
    `);
  const result = stmt.all();

  res.render("competitions/index", { result: { items: result } });
});

// GET /competitions/view/:id
router.get("/view/:id", authRequired, function (req, res, next) {
  // do validation
  const resultValidation = schema_id.validate(req.params);

  const competitionId = req.params.id;
  console.log(competitionId);
  const checkCompetition = db.prepare(
    "SELECT * FROM competitions WHERE id = ?;"
  );
  const competitionInfo = checkCompetition.get(competitionId);

  console.log(competitionInfo);
  if (competitionInfo.team_size === 1) {
    const stmt = db.prepare(`
        SELECT u.name, competitors.score, competitors.apply_time, competitors.score, competitors.id
        FROM competitors, users u
        WHERE competitors.id_user = u.id AND competitors.id_competition = ?
        ORDER BY competitors.score DESC
    `); ///        WHERE competitors.id_competition = ${competitionId}
    const result = stmt.all(req.params.id);

    console.log(result);

    res.render("competitions/view", {
      result: { items: result },
      competitionId: competitionId,
      team: false,
    });
  } else {
    const stmt = db.prepare(`
    SELECT GROUP_CONCAT(DISTINCT u.name) AS teamMembers, teams.score, teams.id_team, teams.name AS name
    FROM competitors
    INNER JOIN users u ON competitors.id_user = u.id
    INNER JOIN teams ON teams.id_user = u.id
    WHERE teams.id_competition = ?
    GROUP BY teams.id_team
    ORDER BY teams.score DESC
`); 
const result = stmt.all(req.params.id);
console.log(result);

res.render("competitions/view", {
  result: { items: result },
  competitionId: competitionId,
  team: true
});

  }
});

router.get("/izvjesce/:id", authRequired, function (req, res, next) {
  // do validation
  const resultValidation = schema_id.validate(req.params);

  const competitionId = req.params.id;

  console.log(competitionId);

  const stmt = db.prepare(`
        SELECT u.name, c.score, c.apply_time, c.score, c.id
        FROM competitors c
        INNER JOIN users u ON c.id_user = u.id
        WHERE c.id_competition = ?
        ORDER BY c.score DESC
    `);

  const result = stmt.all(competitionId).map((item, index) => ({
    ...item,
    position: index + 1,
    showHorizontalLine: index === 2, // Set to true when index reaches 2 (third position)
  }));

  const stmtComp = db.prepare(`
            SELECT name, apply_till
            FROM competitions
            WHERE id = ?
        `);

  const natjecanje = stmtComp.get(competitionId);
  console.log(natjecanje);

  res.render("competitions/izvjesce", {
    result: { items: result },
    natjecanje: natjecanje,
  });
});

// SCHEMA score
const schema_score = Joi.object({
  /*id: Joi.number().integer().positive().required(),*/
  score: Joi.number().integer().positive().required(),
});
// POST /competitions/updatescore/:id
router.post("/updatescore/:id", adminRequired, (req, res, next) => {
  const result = schema_score.validate(req.body);

  console.log(req.body, req.params, result);

  if (result.error) {
    res.render("competitions");
    return;
  }

  const stmt = db.prepare("UPDATE competitors SET score = ? WHERE id = ?");
  const updateResult = stmt.run(req.body.score, req.params.id);

  if (updateResult.changes && updateResult.changes === 1) {
    res.redirect("/competitions");
  } else {
    res.render("/competitions", { result: { database_error: true } });
  }
});
// POST /competitions/team/updatescore/:id
router.post("/team/updatescore/:id", adminRequired, (req, res, next) => {
  const result = schema_score.validate(req.body);

  console.log(req.body, req.params, result);

  if (result.error) {
    res.render("competitions");
    return;
  }

  const stmt = db.prepare("UPDATE teams SET score = ? WHERE id_team = ?");
  const updateResult = stmt.run(req.body.score, req.params.id);

  if (updateResult.changes && updateResult.changes === 1) {
    res.redirect("/competitions");
  } else {
    res.render("/competitions", { result: { database_error: true } });
  }
});


// GET /competitions/delete/competitor/:Id
router.get("/delete/competitor/:id", adminRequired, function (req, res, next) {
  // do validation
  const result = schema_id.validate(req.params);
  console.log(result);
  if (result.error) {
    throw new Error("Neispravan poziv");
  }

  const stmt = db.prepare("DELETE FROM competitors WHERE id = ?;");
  const deleteResult = stmt.run(req.params.id);

  if (!deleteResult.changes || deleteResult.changes !== 1) {
    throw new Error("Operacija nije uspjela");
  }

  res.redirect("/competitions");
});

// GET /competitions/apply/:id
router.get("/apply/:id", authRequired, function (req, res, next) {
  // do validation
  const result = schema_id.validate(req.params);

  const competitionId = parseInt(req.params.id);
  //AKO JE TEAM SIZE = 1 ONDA NEKA NAPRAVI OVO ISPOD AKO NIJE RENDERAJ NOVU RUTU ZA PRIJAVLJIVANJE TIMOVA
  const checkTeamSize = db.prepare(
    "SELECT team_size FROM competitions WHERE id = ?;"
  );
  const teamSize = checkTeamSize.get(competitionId);
  console.log("TEAM SIZE: " + teamSize.team_size);
  if (teamSize.team_size === 1) {
    const checkStmt = db.prepare(
      "SELECT * FROM competitors WHERE id_user = ? AND id_competition = ?;"
    );
    const alreadyApplyed = checkStmt.get(req.user.sub, competitionId);

    if (alreadyApplyed) {
      console.log("User is already registered for this competition.");
      return res.redirect("/competitions");
    }

    const insertStmt = db.prepare(
      "INSERT INTO competitors (id_user, id_competition, apply_time, score) VALUES (?, ?, ?, ?);"
    );
    const insertResult = insertStmt.run(
      req.user.sub,
      competitionId,
      new Date().toISOString(),
      0
    );

    res.redirect("/competitions");
  } else {
    // Check if the user is already associated with a team
    const checkUserTeam = db.prepare("SELECT id FROM teams WHERE id_user = ?;");
    const userTeam = checkUserTeam.get(req.user.sub);

    // Fetch competition info
    const checkCompetition = db.prepare(
      "SELECT * FROM competitions WHERE id = ?;"
    );
    const competitionInfo = checkCompetition.get(competitionId);

    // Fetch teams for the competition
    const checkTeams = db.prepare(
      "SELECT teams.name AS teamName, teams.id_team AS teamId, teams.id as id, GROUP_CONCAT(users.name) AS usernames FROM teams LEFT JOIN users ON teams.id_user = users.id WHERE teams.id_competition = ? GROUP BY teams.id_team;"
    );

    const allTeams = checkTeams.all(competitionId);

    console.log("user team: ");
    console.log(userTeam);
    console.log("all teams: ");
    console.log(allTeams);
    // Include isUserInTeam information in the data passed to the template
    res.render("competitions/teamApply", {
      result: {
        competitionInfo: competitionInfo,
        userTeam: userTeam,
        allTeams: allTeams,
      },
    });
  }
});
// POST /competitions/createTeam
router.post(
  "/createTeam/:competitionId",
  authRequired,
  function (req, res, next) {
    const userId = req.user.sub;

    const competitionId = req.params.competitionId;

    const { teamName } = req.body;

    console.log("///////////////");
    console.log("userId " + userId);
    console.log("competitionId " + competitionId);
    console.log("teamName " + teamName);
    console.log("///////////////");

    const stmt = db.prepare(
      "INSERT INTO teams (id_user, id_competition, name, score) VALUES (?, ?, ?, 0);"
    );
    const insertResult = stmt.run(userId, competitionId, teamName);

    if (insertResult.changes && insertResult.changes === 1) {
      res.redirect(req.get("referer"));
    } else {
      res.status(500).json({ error: "Failed to create team" });
    }
  }
);

router.post("/joinTeam/:id", authRequired, function (req, res, next) {
  const userId = req.user.sub;
  const teamId = req.params.id;

  const checkUserTeam = db.prepare("SELECT id FROM teams WHERE id_user = ?;");
  const userTeam = checkUserTeam.get(userId);

  if (userTeam) {
    return res
      .status(400)
      .json({ error: "User is already a member of a team" });
  }

  const getTeamData = db.prepare("SELECT * FROM teams WHERE id = ?;");
  const teamData = getTeamData.get(teamId);

  if (!teamData) {
    return res.status(404).json({ error: "Team not found" });
  }

  const insertNewTeamUser = db.prepare(
    "INSERT INTO teams (id_user, id_competition, name, id_team) VALUES (?, ?, ?, ? );"
  );
  insertNewTeamUser.run(userId, teamData.id_competition, teamData.name, teamId);

  // Send a success response
  res.status(200).json({ message: "Joined team successfully", team: teamData });
});

// SCHEMA id
const schema_id = Joi.object({
  id: Joi.number().integer().positive().required(),
});

// GET /competitions/delete/:id
router.get("/delete/:id", adminRequired, function (req, res, next) {
  // do validation
  const result = schema_id.validate(req.params);
  if (result.error) {
    throw new Error("Neispravan poziv");
  }

  const stmtCompetitors = db.prepare(
    "DELETE FROM competitors WHERE id_competition = ?;"
  );
  const deleteResultCompetitors = stmtCompetitors.run(req.params.id);

  if (
    !deleteResultCompetitors.changes ||
    deleteResultCompetitors.changes !== 1
  ) {
    throw new Error("Operacija brisanja natjecatelja nije uspjela");
  }

  const stmt = db.prepare("DELETE FROM competitions WHERE id = ?;");
  const deleteResult = stmt.run(req.params.id);

  if (!deleteResult.changes || deleteResult.changes !== 1) {
    throw new Error("Operacija nije uspjela");
  }

  res.redirect("/competitions");
});

// GET /competitions/edit/:id
router.get("/edit/:id", adminRequired, function (req, res, next) {
  // do validation
  const result = schema_id.validate(req.params);
  if (result.error) {
    throw new Error("Neispravan poziv");
  }

  const stmt = db.prepare("SELECT * FROM competitions WHERE id = ?;");
  const selectResult = stmt.get(req.params.id);

  if (!selectResult) {
    throw new Error("Neispravan poziv");
  }

  res.render("competitions/form", {
    result: { display_form: true, edit: selectResult },
  });
});

// SCHEMA edit
const schema_edit = Joi.object({
  name: Joi.string().min(3).max(50).required(),
  description: Joi.string().min(3).max(1000).required(),
  apply_till: Joi.date().iso().required(),
  team_size: Joi.number().integer().positive().required(),
  id: Joi.number().integer().positive().required(),
});

// POST /competitions/edit
router.post("/edit", adminRequired, function (req, res, next) {
  // do validation
  const result = schema_edit.validate(req.body);
  if (result.error) {
    res.render("competitions/form", {
      result: { validation_error: true, display_form: true },
    });
    return;
  }

  const stmt = db.prepare(
    "UPDATE competitions SET name = ?, description = ?, team_size =?,  apply_till = ? WHERE id = ?"
  );
  const updateResult = stmt.run(
    req.body.name,
    req.body.description,
    req.body.team_size,
    req.body.apply_till,
    req.body.id
  );

  if (updateResult.changes && updateResult.changes === 1) {
    res.redirect("/competitions");
  } else {
    res.render("competitions/form", { result: { database_error: true } });
  }
});

// GET /competitions/add
router.get("/add", adminRequired, function (req, res, next) {
  res.render("competitions/form", { result: { display_form: true } });
});

// SCHEMA add
const schema_add = Joi.object({
  name: Joi.string().min(3).max(50).required(),
  description: Joi.string().min(3).max(1000).required(),
  team_size: Joi.number().integer().positive().required(),
  apply_till: Joi.date().iso().required(),
});

// POST /competitions/add
router.post("/add", adminRequired, function (req, res, next) {
  // do validation
  const result = schema_add.validate(req.body);
  console.log(result);
  if (result.error) {
    res.render("competitions/form", {
      result: { validation_error: true, display_form: true },
    });
    return;
  }

  const stmt = db.prepare(
    "INSERT INTO competitions (name, description, team_size, author_id, apply_till) VALUES (?, ?, ?, ?, ?);"
  );
  const insertResult = stmt.run(
    req.body.name,
    req.body.description,
    req.body.team_size,
    req.user.sub,
    req.body.apply_till
  );

  if (insertResult.changes && insertResult.changes === 1) {
    res.render("competitions/form", { result: { success: true } });
  } else {
    res.render("competitions/form", { result: { database_error: true } });
  }
});

module.exports = router;
