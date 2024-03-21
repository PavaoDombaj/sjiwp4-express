const express = require("express");
const router = express.Router();
const { authRequired, adminRequired } = require("../services/auth.js");
const Joi = require("joi");
const { db } = require("../services/db.js");


// GET /competitions
router.get("/", authRequired, function (req, res, next) {
    const stmt = db.prepare(`
        SELECT c.id, c.name, c.description, u.name AS author, c.apply_till
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
    console.log(competitionId)

    const stmt = db.prepare(`
        SELECT u.name, competitors.score, competitors.apply_time, competitors.score, competitors.id
        FROM competitors, users u
        WHERE competitors.id_user = u.id AND competitors.id_competition = ?
        ORDER BY competitors.score DESC
    `); ///        WHERE competitors.id_competition = ${competitionId}
    const result = stmt.all(req.params.id);

    console.log(result)

    res.render("competitions/view", { result: { items: result }, competitionId: competitionId });
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

    result = stmt.all(competitionId)

    const stmtComp = db.prepare(`
            SELECT name, apply_till
            FROM competitions
            WHERE id = ?
        `);

    const natjecanje = stmtComp.get(competitionId)
    console.log(natjecanje)

    res.render("competitions/izvjesce", { result: { items: result }, natjecanje: natjecanje });
});





// SCHEMA score
const schema_score = Joi.object({
    /*id: Joi.number().integer().positive().required(),*/
    score: Joi.number().integer().positive().required(),
});
// POST /competitions/updatescore/:id
router.post('/updatescore/:id', adminRequired, (req, res, next) => {
    const result = schema_score.validate(req.body);


    console.log(req.body, req.params, result);

    if (result.error) {
        res.render("competitions");
        return;
    }

    const stmt = db.prepare("UPDATE competitors SET score = ? WHERE id = ?");
    const updateResult = stmt.run(req.body.score, req.params.id);

    if (updateResult.changes && updateResult.changes === 1) {
        res.redirect('/competitions');
    } else {
        res.render("/competitions", { result: { database_error: true } });
    }
});

// GET /competitions/delete/competitor/:Id
router.get("/delete/competitor/:id", adminRequired, function (req, res, next) {
    // do validation
    const result = schema_id.validate(req.params);
    console.log(result)
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


    const checkStmt = db.prepare("SELECT * FROM competitors WHERE id_user = ? AND id_competition = ?;");
    const alreadyApplyed = checkStmt.get(req.user.sub, competitionId);

    if (alreadyApplyed) {
        console.log("User is already registered for this competition.");
        return res.redirect("/competitions");
    }

    const insertStmt = db.prepare("INSERT INTO competitors (id_user, id_competition, apply_time, score) VALUES (?, ?, ?, ?);");
    const insertResult = insertStmt.run(req.user.sub, competitionId, new Date().toISOString(), 0);

    // dodaj zavrsetak
    //res.render("/competitions/view/:id"); ///neradi
    return res.redirect("/competitions");
});




// SCHEMA id
const schema_id = Joi.object({
    id: Joi.number().integer().positive().required()
});

// GET /competitions/delete/:id
router.get("/delete/:id", adminRequired, function (req, res, next) {
    // do validation
    const result = schema_id.validate(req.params);
    if (result.error) {
        throw new Error("Neispravan poziv");
    }

    const stmtCompetitors = db.prepare("DELETE FROM competitors WHERE id_competition = ?;");
    const deleteResultCompetitors = stmtCompetitors.run(req.params.id);

    if (!deleteResultCompetitors.changes || deleteResultCompetitors.changes !== 1) {
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

    res.render("competitions/form", { result: { display_form: true, edit: selectResult } });
});

// SCHEMA edit
const schema_edit = Joi.object({
    name: Joi.string().min(3).max(50).required(),
    description: Joi.string().min(3).max(1000).required(),
    apply_till: Joi.date().iso().required(),
    id: Joi.number().integer().positive().required()

});


// POST /competitions/edit
router.post("/edit", adminRequired, function (req, res, next) {
    // do validation
    const result = schema_edit.validate(req.body);
    if (result.error) {
        res.render("competitions/form", { result: { validation_error: true, display_form: true } });
        return;
    }

    const stmt = db.prepare("UPDATE competitions SET name = ?, description = ?, apply_till = ? WHERE id = ?");
    const updateResult = stmt.run(req.body.name, req.body.description, req.body.apply_till, req.body.id);

    if (updateResult.changes && updateResult.changes === 1) {
        res.redirect("/competitions")
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
    apply_till: Joi.date().iso().required()
});

// POST /competitions/add
router.post("/add", adminRequired, function (req, res, next) {
    // do validation
    const result = schema_add.validate(req.body);
    if (result.error) {
        res.render("competitions/form", { result: { validation_error: true, display_form: true } });
        return;
    }

    const stmt = db.prepare("INSERT INTO competitions (name, description, author_id, apply_till) VALUES (?, ?, ?, ?);");
    const insertResult = stmt.run(req.body.name, req.body.description, req.user.sub, req.body.apply_till);

    if (insertResult.changes && insertResult.changes === 1) {
        res.render("competitions/form", { result: { success: true } });
    } else {
        res.render("competitions/form", { result: { database_error: true } });
    }
});

module.exports = router;