var express = require("express");
var path = require("path");
var logger = require("morgan");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
var neo4j = require("neo4j-driver");

var app = express();

//view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

//NEO4J driver initialize
var driver = neo4j.driver(
  "bolt://localhost",
  neo4j.auth.basic("neo4j", "redhat")
);
var session = driver.session();

app.get("/", (req, res) => {
  session
    // .run("MATCH (n:Person) RETURN n")
    .run(`MATCH (n:Person) RETURN n`)
    .then((result) => {
      var personArr = [];
      result.records.forEach((record) => {
        // console.log(record._fields[0]);
        personArr.push({
          id: record._fields[0].identity.low,
          name: record._fields[0].properties.name,
        });
      });

      //Nested query for Location
      session
        // .run("MATCH (n:Person) RETURN n")
        .run(`MATCH (n:Location) RETURN n`)
        .then((resultTwo) => {
          var locationArr = [];
          resultTwo.records.forEach((record) => {
            // console.log(record._fields[0]);
            locationArr.push(
              // id: record._fields[0].identity.low,
              // City: record._fields[0].properties.city,
              record._fields[0].properties
            );
          });
          res.render("index", {
            persons: personArr,
            locations: locationArr,
          });
        });
    })
    .catch((error) => {
      console.log(error);
    });
});

//Add Person Node in database
app.post("/person/add", (req, res) => {
  var name = req.body.name;
  //   console.log(name);
  session
    .run("CREATE(n:Person {name: $nameParam}) RETURN n.name", {
      nameParam: name,
    })
    .then((result) => {
      res.redirect("/");
      // session.close(); //Not REquire
    })
    .catch((error) => {
      console.log(error);
    });
});

//Add Location Node in database
app.post("/location/add", (req, res) => {
  var city = req.body.city;
  var state = req.body.state;
  //   console.log(name);
  session
    .run("CREATE(n:Location {city: $cityParam, state:$stateParam}) RETURN n", {
      cityParam: city,
      stateParam: state,
    })
    .then((result) => {
      res.redirect("/");
      // session.close(); //Not REquire
    })
    .catch((error) => {
      console.log(error);
    });
});

//Friend connect route
app.post("/friends/connect", (req, res) => {
  var name1 = req.body.name1;
  var name2 = req.body.name2;
  var id = req.body.id;
  //   console.log(name);
  session
    .run(
      "MATCH (a:Person {name: $nameParamOne}), (b:Person {name: $nameParamTwo}) MERGE(a)-[r:FRIENDS]->(b) RETURN a,b",
      {
        nameParamOne: name1,
        nameParamTwo: name2,
      }
    )
    .then((result) => {
      if (id && id != null) {
        res.redirect("/person/" + id);
      } else {
        res.redirect("/");
      }
      // session.close(); //Not REquire
    })
    .catch((error) => {
      console.log(error);
    });
});

//Add Birthplace year
app.post("/person/born/add", (req, res) => {
  var name = req.body.name;
  var city = req.body.city;
  var state = req.body.state;
  var year = req.body.year;
  var id = req.body.id;
  //   console.log(name);
  session
    .run(
      "MATCH (a:Person {name: $nameParam}), (b:Location {city: $cityParam, state:$stateParam}) MERGE(a)-[r:BORN_IN {year: $yearParam}]->(b) RETURN a,b",
      {
        nameParam: name,
        cityParam: city,
        stateParam: state,
        yearParam: year,
      }
    )
    .then((result) => {
      if (id && id != null) {
        res.redirect("/person/" + id);
      } else {
        res.redirect("/");
      }
      // session.close(); //Not REquire
    })
    .catch((error) => {
      console.log(error);
    });
});

//Person redirection route to its main page
app.get("/person/:id", (req, res) => {
  var id = req.params.id;
  //res.send(id);
  session
    .run(
      "MATCH(a:Person) WHERE id(a)=toInteger($idParam) RETURN a.name as name",
      {
        idParam: id,
      }
    )
    .then((result) => {
      var name = result.records[0].get("name");

      session
        .run(
          "OPTIONAL MATCH(a:Person)-[r:BORN_IN]-(b:Location) WHERE id(a)=toInteger($idParam) RETURN b.city as city, b.state as state",
          { idParam: id }
        )
        .then((resultTwo) => {
          var city = resultTwo.records[0].get("city");
          var state = resultTwo.records[0].get("state");

          session
            .run(
              "OPTIONAL MATCH(a:Person)-[r:FRIENDS]-(b:Person) WHERE id(a)=toInteger($idParam) RETURN b",
              { idParam: id }
            )
            .then((resultThree) => {
              var friendsArr = [];
              resultThree.records.forEach((record) => {
                if (record._fields[0] != null) {
                  friendsArr.push({
                    id: record._fields[0].identity.low,
                    name: record._fields[0].properties.name,
                  });
                }
              });
              res.render("person", {
                id: id,
                name: name,
                city: city,
                state: state,
                friends: friendsArr,
              });
            })
            .catch((error) => {
              console.log(error);
            });
        })
        .catch((error) => {
          console.log(error);
        });
    })
    .catch((error) => {
      console.log(error);
    });
});

app.listen(3000);
console.log("Server running on port: 3000");

module.exports = app;
