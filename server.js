//The server retrieves the express module and stores it as a variable
var express = require("express");
//Creates a new express application and stores it withing the app variable
var app = express();
//Gets the http module built within node.js and then creates an instance of a server
//and then stores this instance in the server variable
var server = require("http").Server(app);
//Attatches the socket.io module to the server instance
var io = require("socket.io")(server);
//Loads the mysql module from the node library
var mysql = require("mysql");
//When the server recieves an http get request it will send the index.html document to the client.
app.get("/",function(req,res){
	res.sendFile(__dirname + "/client/index.html");
});
//Allows the client to request static files from the client directory stored at the server.
app.use("/client",express.static(__dirname + "/client"));
//The server begins listening on the port 2000
server.listen(2000);
//The server creates a connection with the database using some predefined credentials
var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "qwerty123",
	database: "antion_online"
});
//The server checks to see if the connection to the database was successful
con.connect(function(err) {
	if(!err) {
    console.log("Database is connected");
} else {
		console.log(err);
    console.log("Error connecting to database");
}
});
//The server sets all the players ingame values in the database to 0
con.query("UPDATE player SET ingame=0");
//A list is created that will contain all of the socket objects for the players
var socketList = [];
//A list is created that will contain all active fireball attacks
var fireballList = [];
//A list is created that will contain all active slash attacks
var slashList = [];
//A list is created that will contain al of the dagger attacks
var daggerList = [];
//A list is created that will contain al of the lightning attacks
var lightningList = [];
//A list is created that will contain al of the freeze attacks
var freezeList = [];
//The server instance listens to see if a connection has been made.
io.sockets.on("connection",function(socket){
	console.log("connection established");
	socket.emit("connectionCheck","the connection is established");
//The server listens for a disconnect event
	socket.on("disconnect",function(){
		//The system removes the player from the socket list when they disconnect
		delete socketList[socket.id]
		//The system sets the ingame value to 0 in the database
		con.query("UPDATE player SET ingame=0 WHERE username=?",[socket.username]);
		//The server will display a message showing that the client has diconnected to the console
		console.log("a disconnect has been detected");
	});
	//The server will run a procedure when it detects a sign up request from the client
	socket.on("signUpReq",function(data){
		//The program searches throught the database to see if anyone else has registered under the same userame.
		con.query("SELECT * FROM player WHERE username = ?",[data.username],function(err,results,fields){
			//If there are other accounts under the same username the server will emit that the registration has failed
			if(results.length > 0){
				socket.emit("signUpConf",{success:false});
			}
			//If the account has no duplicates the database will enter their details into the database
			else{
				//Inserts the users username and password into the database
				con.query("INSERT INTO player SET ?",data, function (err, result) {
					if (err) throw err;
					//Works out the users ID in the database, and sets other default values
					con.query("SELECT * FROM player",function(err,lengthResult,fields){
						con.query("UPDATE player SET playerId=?, ingame=0, level=1, exp=0 WHERE username=?",[lengthResult.length+1,data.username]);
					});
					socket.emit("signUpConf",{success:true});
				});
			}
		});
	});
	//The server will run a procedure when it detects a sign in request from the client
	socket.on("signInReq",function(data){
		//The server searches through the database to access the data of players under the username the request contains
		con.query("SELECT * FROM player WHERE username = ?",[data.username],function(err,results,fields){
			//The server checks to see if there is a player with the username that the request contains
			if(results.length > 0){
				//If there is an account under this username the server will see if the account is in use.
				if(results[0].ingame === 0){
					//If the account is not in use the server will check if the request contains the correct credentials
					if(results[0].username === data.username && results[0].password === data.password){
						//Stores the username of the client as a property of the socket
						socket.username = data.username;
						//Stores the ID of the client as a property of the socket object
						socket.id = results[0].playerID;
						//The server sends the id of the player to the client
						socket.emit("idSend",socket.id);
						//Stores the position of the client as properties of the socket object
						socket.x = 0;
						socket.y = 0;
						//Stores the rate at which the player should be moving as a property of the socket object
						socket.velocityx = 0;
						socket.velocityy = 0;
						//If the credentials are correct the server will set the account to active
						con.query("UPDATE player SET ingame=1 WHERE username=?",[data.username]);
						//The server will see if the user has selected a character
						if(results[0].class === null){
							//The client a message containing information on if the sign in was successful and if a character has been selected
							socket.emit("signInConf",{success:true,selected:false});
						}
						else {
							//The socket object of the user is stored into the server's socket list with an index of its ID
							socketList[socket.id] = socket;
							//The client a message containing information on if the sign in was successful and if a character has been selected
							socket.emit("signInConf",{success:true,selected:true});
							//The server stores the path to the image of the character that the player is using
							if(results[0].class === "wizard"){
								socket.character = "/client/img/wizard.png";
								//The server sets the maximum health of the player based on their class
								socket.maxHealth = 100;
								socket.maxMana = 100;
								socket.mana = socket.maxMana;
							}
							if(results[0].class === "pirate"){
								socket.character = "/client/img/pirate.png";
								//The server sets the maximum health of the player based on their class
								socket.maxHealth = 150;
							}
							if(results[0].class === "ogre"){
								socket.character = "/client/img/ogre.png";
								//The server sets the maximum health of the player based on their class
								socket.maxHealth = 200;
							}
							//The server emits the character to the client
							socket.emit("charSend",socket.character);
							socket.health = socket.maxHealth;
						}
					}
					//If the users credentials are incorrect the server will send a failure message to the client
					else{
						socket.emit("signInConf",{success:false});
					}
				}
				//If the account being accessed is in use the server will message the client that it is in use
				else{
					socket.emit("signInConf",{success:"ingame"});
				}
			}
			//If there are no results found in the database the server will send a failure message to the client
			else{
				socket.emit("signInConf",{success:false});
			}
		});
	});
	//The server will run a procedure when it detect a CharSelected message from the client
	socket.on("CharSelected",function(data){
		//The server decides what to do based on which character the user has chosen
		if(data === 1){
			//The server stores the path to the image of the wizard
			socket.character = "/client/img/wizard.png";
			//The server sets the maximum health of the player based on their class
			socket.maxHealth = 100;
			socket.maxMana = 100;
			socket.mana = socket.maxMana;
			//The server adds the character that the user has chosen to the database
			con.query("UPDATE player SET class='wizard' WHERE username=?",[socket.username]);
		}
		if(data === 2){
			//The server stores the path to the image of the pirate
			socket.character = "/client/img/pirate.png";
			//The server sets the maximum health of the player based on their class
			socket.maxHealth = 150;
			//The server adds the character that the user has chosen to the database
			con.query("UPDATE player SET class='pirate' WHERE username=?",[socket.username]);
		}
		if(data === 3){
			//The server stores the path to the image of the ogre
			socket.character = "/client/img/ogre.png";
			//The server sets the maximum health of the player based on their class
			socket.maxHealth = 200;
			//The server adds the character that the user has chosen to the database
			con.query("UPDATE player SET class='ogre' WHERE username=?",[socket.username]);
		}
		socket.health = socket.maxHealth;
		//The server emits the character to the client
		socket.emit("charSend",socket.character);
		//The socket object of the user is stored into the server's socket list with an index of its ID
		socketList[socket.id] = socket;
	});
	//The server add the username of the client to the message and then sends the message to every other client
	socket.on("msgSent",function(data){
		var userName = socket.username;
		for(var i in socketList){
			socketList[i].emit("textRecieved",userName+ ": "+data);
		}
	});
	//The server listens for a keypress from the client
	socket.on("keypress",function(data){
		//The server changes the movement of the player based off of what message it recieved from the client
		if(data.inputID === "right")
			socket.right = data.state;
		else if(data.inputID === "left")
			socket.left = data.state;
		else if(data.inputID === "up")
			socket.up = data.state;
		else if(data.inputID === "down")
			socket.down = data.state;
	});
	//The server listens for the fireball event
	socket.on("fireball",function(data){
		if(socket.mana > 10){
			socket.mana -= 10;
			fireballList.push({x:socket.x,y:socket.y,angle:data,ownerID:socket.id,duration:66});
		}
	});
	//The server listens for the lightning
	socket.on("lightning",function(data){
		if(socket.mana > 50){
			socket.mana -= 50;
			//The server calculates two points perpendicular to the direction of the attack that the attack can vary in
			var xRange1 = (Math.cos(data + 3.1415/2))*27;
			var xRange2 = (Math.cos(data - 3.1415/2))*27;
			var yRange1 = (Math.sin(data + 3.1415/2))*27;
			var yRange2 = (Math.sin(data - 3.1415/2))*27;
			//The server creates a list to store the co-ordinates that will define the hitbox of the attack
			var lightningRect = [{x:socket.x - xRange1 , y:socket.y - yRange1},{x:socket.x + xRange1 , y:socket.y + yRange1},{x:socket.x - xRange1 + 180*Math.cos(data) , y:socket.y - yRange1 + 180*Math.sin(data)},{x:socket.x + xRange1 + 180*Math.cos(data) , y:socket.y + yRange1 + 180*Math.cos(data)}];
			//The server creates 7 points for four attacks along the line of travel of the attack
			for(var i = 0; i < 4; i++){
				var xPoint1 = socket.x + (Math.random() * (xRange1 - xRange2) + xRange2);
				var xPoint2 = (socket.x + 30*Math.cos(data)) + (Math.random() * (xRange1 - xRange2) + xRange2);
				var xPoint3 = (socket.x + 60*Math.cos(data)) + (Math.random() * (xRange1 - xRange2) + xRange2);
				var xPoint4 = (socket.x + 90*Math.cos(data)) + (Math.random() * (xRange1 - xRange2) + xRange2);
				var xPoint5 = (socket.x + 120*Math.cos(data)) + (Math.random() * (xRange1 - xRange2) + xRange2);
				var xPoint6 = (socket.x + 150*Math.cos(data)) + (Math.random() * (xRange1 - xRange2) + xRange2);
				var xPoint7 = (socket.x + 180*Math.cos(data)) + (Math.random() * (xRange1 - xRange2) + xRange2);

				var yPoint1 = socket.y + (Math.random() * (yRange1 - yRange2) + yRange2);
				var yPoint2 = (socket.y + 30*Math.sin(data)) + (Math.random() * (yRange1 - yRange2) + yRange2);
				var yPoint3 = (socket.y + 60*Math.sin(data)) + (Math.random() * (yRange1 - yRange2) + yRange2);
				var yPoint4 = (socket.y + 90*Math.sin(data)) + (Math.random() * (yRange1 - yRange2) + yRange2);
				var yPoint5 = (socket.y + 120*Math.sin(data)) + (Math.random() * (yRange1 - yRange2) + yRange2);
				var yPoint6 = (socket.y + 150*Math.sin(data)) + (Math.random() * (yRange1 - yRange2) + yRange2);
				var yPoint7 = (socket.y + 180*Math.sin(data)) + (Math.random() * (yRange1 - yRange2) + yRange2);
				//The server adds the hitbox, the co-ordinates of the points to be drawn, the id of the owner of each attack and the duration of each attack to the lightning list
				lightningList.push({rectangle:lightningRect,x1:xPoint1,x2:xPoint2,x3:xPoint3,x4:xPoint4,x5:xPoint5,x6:xPoint6,x7:xPoint7,y1:yPoint1,y2:yPoint2,y3:yPoint3,y4:yPoint4,y5:yPoint5,y6:yPoint6,y7:yPoint7,ownerID:socket.id,duration:20});
			}
		}
	});
	//The server listens for the freeze event
	socket.on("freeze",function(){
		if(socket.mana > 50){
			socket.mana -= 50;
			//an object containing all required information is pushed to the dagger list
			freezeList.push({x:socket.x,y:socket.y,ownerID:socket.id,duration:165});
		}
	});
	//The server listens for the dagger event
	socket.on("dagger",function(data){
		//an object containing all required information is pushed to the dagger list
		daggerList.push({x:socket.x,y:socket.y,angle:data,ownerID:socket.id,duration:66});
	});
	//The server listen for the slash event
	socket.on("slash",function(data){
		//The server sets the damage of the attack based on the state that the user is in
		if(data.state === "poison"){
			var slashDamage = 8;
		}
		if(data.state === "manaSlash"){
			var slashDamage = 8;
		}
		if(data.state === "armour"){
			var slashDamage = 5;
		}
		if(data.state === "speed"){
			var slashDamage = 7;
		}
		if(data.state === "rage"){
			var slashDamage = 10;
		}
		slashList.push({x:socket.x + Math.cos(data.angle)*70 - 27,y:socket.y + Math.sin(data.angle)*70 + 43,ownerID:socket.id,duration:5,damage:slashDamage, state:data.state});
	});
	//The server removes the players armour on recieving the armour off message
	socket.on("armourOff",function(){
		if(socket.armour === true){
			socket.health = socket.health / 1.5;
			socket.maxHealth = socket.maxHealth / 1.5;
			socket.armour = false;
		}
	});
	//The server adds armour ot the player upon recieving the armour on message
	socket.on("armourOn",function(){
		socket.armour = true;
		socket.health = socket.health * 1.5;
		socket.maxHealth = socket.maxHealth * 1.5;

	});
	socket.on("speedOn",function(){
		socket.speed = true;
	});
	socket.on("speedOff",function(){
		socket.speed = false;
	});
	socket.on("heal",function(){
		if(socket.maxHealth - socket.health > 5)
			socket.health += 5;
	});
	socket.on("boom",function(){
		socket.health = 0;
		for(var i in socketList){
			if(Math.sqrt(Math.pow(socketList[i].x - socket.x,2)+Math.pow(socketList[i].y - socket.y,2)) < 250)
				socketList[i].health -= 75;
		}
	});
	socket.on("teleport",function(data){
		if(socket.mana > 5){
			socket.mana -= 5
			socket.x = socket.x + data.x;
			socket.y = socket.y + data.y;
		}
	});
});
//The server creates a function that will run every 33 milliseconds
setInterval(function(){
	//The server will create a list that will contain information to be sent to the client
	var playerPack = [];
	//The server iterates through the list of freeze attacks
	for(var i in freezeList){
		freezeList[i].x = socketList[freezeList[i].ownerID].x;
		freezeList[i].y = socketList[freezeList[i].ownerID].y;
		for(var m in socketList){
			if(Math.sqrt(Math.pow(socketList[m].x - freezeList[i].x,2)+Math.pow(socketList[m].y - freezeList[i].y,2)) < 150 && socketList[m].id != freezeList[i].ownerID){
				if(socketList[m].velocityx > 4)
					socketList[m].velocityx = socketList[m].velocityx - 2;
				if(socketList[m].velocityx < -4)
					socketList[m].velocityx = socketList[m].velocityx + 2;
				if(socketList[m].velocityy < -4)
					socketList[m].velocityy = socketList[m].velocityx + 2;
				if(socketList[m].velocityy > 4)
						socketList[m].velocityy = socketList[m].velocityx - 2;
			}
		}
		//The freeze attack's duration is reduced by 1
		freezeList[i].duration -= 1;
		//The freeze attack is removed from the lightning list if its duration has run out
		if(freezeList[i].duration <= 0){
			freezeList.splice(i,1);
		}
	}
	//The server iterates through the list of lightning
	for(var i in lightningList){
		for(var m in socketList){
			var overlap = true;
			var rectangles = [lightningList[i].rectangle, [{x:socketList[m].x - 27,y:socketList[m].y + 53 },{x:socketList[m].x - 27, y:socketList[m].y - 53 },{x:socketList[m].x + 27, y:socketList[m].y + 53 },{x:socketList[m].x + 27, y:socketList[m].y - 53 }]];
	    var minA, maxA, projected, n, i1, j, minB, maxB;

	    for (n = 0; n < rectangles.length; n++) {
	      // for each polygon, look at each edge of the polygon, and determine if it separates the two shapes
	      var rectangle = rectangles[n];
	      for (n1 = 0; n1 < rectangle.length; n1++) {

	          // grab 2 vertices to create an edge
	          var n2 = (n1 + 1) % rectangle.length;
	          var p1 = rectangle[n1];
	          var p2 = rectangle[n2];

	          // find the line perpendicular to this edge
	          var normal = { x: p2.y - p1.y, y: p1.x - p2.x };

	          minA = maxA = null;
	          // for each vertex in the first shape, project it onto the line perpendicular to the edge and keep track of the min and max of these values
	          for (j = 0; j < rectangles[0].length; j++) {
	              projected = normal.x * rectangles[0][j].x + normal.y * rectangles[0][j].y;
	              if (minA === null || projected < minA) {
	                  minA = projected;
	              }
	              if (maxA === null|| projected > maxA) {
	                  maxA = projected;
	              }
	          }

	          // for each vertex in the second shape, project it onto the line perpendicular to the edge and keep track of the min and max of these values
	          minB = maxB = null;
	          for (j = 0; j < rectangles[1].length; j++) {
	              projected = normal.x * rectangles[1][j].x + normal.y * rectangles[1][j].y;
	              if (minB === null || projected < minB) {
	                  minB = projected;
	              }
	              if (maxB === null || projected > maxB) {
	                  maxB = projected;
	              }
	          }

	          if (maxA < minB || maxB < minA) {
	              overlap = false;
	          }

	      }
	    }
			if(overlap === true && socketList[m].id != lightningList[i].ownerID){
				socketList[m].health -= 1;
			}
		}
		//The lightnings duration is reduced by 1
		lightningList[i].duration -= 1;
		//The lightning is removed from the lightning list if its duration has run out
		if(lightningList[i].duration <= 0){
			lightningList.splice(i,1);
		}
	}
	//The server iterates through the list of slashes
	for(var i in slashList){
		//The slash's duration is reduced by 1
		slashList[i].duration -= 1;
		//The slash is removed from the fireball list if its duration has run out
		if(slashList[i].duration <= 0){
			slashList.splice(i,1);
		}
	}
	//The server iterates through the slashl list
	for(var i in slashList){
		//The slash ha variables created that define its hitbox
		var slashLeft = slashList[i].x - 54;
		var slashRight = slashList[i].x + 54;
		var slashTop = slashList[i].y - 27;
		var slashBottom = slashList[i].y + 27;
		for(var m in socketList){
			if(slashList[i] != undefined){
				if(socketList[m].id != slashList[i].ownerID){
					if(!(slashLeft > socketList[m].x + 27 || slashRight < socketList[m].x - 27 || slashTop > socketList[m].y + 53 || slashBottom < socketList[m].y - 53)){
						socketList[m].health -= slashList[i].damage;
						if(slashList[i].state === "poison"){
							socketList[m].poisoned = true;
							socketList[m].poisonedDuration = 264;
						}
						if(slashList[i].state === "manaSlash"){
							socketList[m].mana = socketList[m].mana/2;
						}
					}
				}
			}
		}
	}
	//The server iterates through the list of fireballss
	for(var i in fireballList){
		//The fireballs duration is reduced by 1
		fireballList[i].duration -= 1;
		//The fireball is removed from the fireball list if its duration has run out
		if(fireballList[i].duration <= 0){
			fireballList.splice(i,1);
		}
	}
	//The server iterates through the fireball list
	for(var i in fireballList){
		//The fireball ha variables created that define its hitbox
		var fireballLeft = fireballList[i].x - 27;
		var fireballRight = fireballList[i].x + 27;
		var fireballTop = fireballList[i].y - 27;
		var fireballBottom = fireballList[i].y + 27;
		//The fireball's position is changed in its direction of travel
		fireballList[i].x += Math.cos(fireballList[i].angle)*12;
		fireballList[i].y += Math.sin(fireballList[i].angle)*12;
		//The server checks to see if a fireball intersects a player
		for(var m in socketList){
			if(fireballList[i] != undefined){
				if(socketList[m].id != fireballList[i].ownerID){
					if(!(fireballLeft > socketList[m].x + 27 || fireballRight < socketList[m].x - 27 || fireballTop > socketList[m].y + 53 || fireballBottom < socketList[m].y - 53)){
						fireballList.splice(i,1);
						socketList[m].health -= 10;
					}
				}
			}
		}
	}
	//The server iterates through the list of daggers
	for(var i in daggerList){
		//The daggers duration is reduced by 1
		daggerList[i].duration -= 1;
		//The dagger is removed from the dagger list if its duration has run out
		if(daggerList[i].duration <= 0){
			daggerList.splice(i,1);
		}
	}
	//The server iterates through the dagger list
	for(var i in daggerList){
		//The dagger has variables created that define its hitbox
		var daggerLeft = daggerList[i].x - 10;
		var daggerRight = daggerList[i].x + 10;
		var daggerTop = daggerList[i].y - 27;
		var daggerBottom = daggerList[i].y + 27;
		//The daggers position is changed in its direction of travel
		daggerList[i].x += Math.cos(daggerList[i].angle)*12;
		daggerList[i].y += Math.sin(daggerList[i].angle)*12;
		//The server checks to see if a dagger intersects a player
		for(var m in socketList){
			if(daggerList[i] != undefined){
				if(socketList[m].id != daggerList[i].ownerID){
					if(!(daggerLeft > socketList[m].x + 27 || daggerRight < socketList[m].x - 27 || daggerTop > socketList[m].y + 53 || daggerBottom < socketList[m].y - 53)){
						daggerList.splice(i,1);
						socketList[m].health -= 5;
					}
				}
			}
		}
	}
	//The server will run through each item in the socket list
	for(var i in socketList){
		//The server stores the socket object at the current index in the socket list in the socket variable
		var socket = socketList[i];
		//If the socket should be moving right and the current x velocity is less than 10 the velocity will be increased by 1
		if(socket.right === true && socket.velocityx < 10)
			socket.velocityx += 1;
		//If the socket should be moving up and the current y velocity is greater than -10 the velocity will be decreased by 1
		if(socket.up === true && socket.velocityy > -10)
			socket.velocityy -= 1;
		//If the socket should be moving down and the current y velocity is less than 10 the velocity will be increased by 1
		if(socket.down === true && socket.velocityy < 10)
			socket.velocityy += 1;
		//If the socket should be moving left and the current x velocity is greater than -10 the velocity will be decreased by 1
		if(socket.left === true && socket.velocityx > -10)
			socket.velocityx -= 1;


		if(socket.right === true && socket.velocityx < 20 && socket.speed === true)
			socket.velocityx += 1;
		if(socket.up === true && socket.velocityy > -20 && socket.speed === true)
			socket.velocityy -= 1;
		if(socket.down === true && socket.velocityy < 20 && socket.speed === true)
			socket.velocityy += 1;
		if(socket.left === true && socket.velocityx > -20 && socket.speed === true)
			socket.velocityx -= 1;
		//if the velocity horizontally of the socket is greater than 0 it will be decreased by 0.5
		if(socket.velocityx > 0)
			socket.velocityx -= 0.5;
		//if the velocity horizontally of the socket is less than 0 it will be increased by 0.5
		if(socket.velocityx < 0)
			socket.velocityx += 0.5;
		//if the velocity vertically of the socket is greater than 0 it will be decreased by 0.5
		if(socket.velocityy > 0)
			socket.velocityy -= 0.5;
		//if the velocity vertically of the socket is less than 0 it will be increased by 0.5
		if(socket.velocityy < 0)
			socket.velocityy += 0.5;
		//The position of the player will be adjusted based on the velocity of their character
		socket.x += socket.velocityx;
		socket.y += socket.velocityy;
		if(socket.poisoned === true){
			socket.health -= 0.2;
			socket.poisonedDuration -= 1;
		}
		if(socket.poisonedDuration <= 0){
			socket.poisoned = false;
		}
		//The server checks if the players health is less than or equal to 0
		if(socket.health <= 0){
			//Sends the player to a random location on the map and resets their health
			socket.x = Math.floor(Math.random() * 4800);
			socket.y = Math.floor(Math.random() * 4800);
			socket.health = socket.maxHealth;
			socket.mana = socket.maxMana;
		}
		if(socket.mana < socket.maxMana)
			socket.mana += 0.2;
		//The server adds an object to the player pack list
		playerPack.push({
			char:socket.character,
			x:socket.x,
			y:socket.y,
			socID:socket.id,
			healthFill:(socket.health/socket.maxHealth)*100*0.75,
			manaFill:(socket.mana/socket.maxMana)*100*0.75
		});
	}
	//The server runs through each item in the socket list and sends the playerpack containing information on each player to the clients
	for(var i in socketList){
		var socket = socketList[i]
		socket.emit("update",{playerPack,fireballList,slashList,daggerList,lightningList,freezeList});
	}

}, 33);
