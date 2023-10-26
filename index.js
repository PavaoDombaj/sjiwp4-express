const express = require("express");
const app = express();
const port = 8080;

app.get("/", (request, response) => {
    response.send("I am alive!");
});

app.get("/proba/:name", (request, response) => {
    response.send("Hello, " + request.params.name);
});

app.listen(port, () => {
    console.log("I am ready!");
});