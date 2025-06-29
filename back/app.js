const {
  express,
  fs,
  bodyParser,
  Server,
  createCanvas,
  cors,
} = require('./js/dependence');
const {
	port,
} = require("./js/config");
const app=express();
app.use(bodyParser.urlencoded({extended:false}));// extended:true pour prendre en charge les sous-objet
app.set("views", __dirname+"/html");
app.use(express.static("css"));
app.use(express.static("images"));
app.use(express.static("js"));
app.engine("html",require("ejs").renderFile);
app.engine("css",require("ejs").renderFile);
app.engine("ico",require("ejs").renderFile);
app.engine("js",require("ejs").renderFile);
// Ecoute du serveur
if (!port) {
  console.error("ERREUR : process.env.PORT est non défini !");
  process.exit(1);
}
const server = app.listen(port,(err)=>{
  if(err){
    console.log("Le serveur n'a pas pu démarrer");
  } else{
    console.log("Le serveur est en écoute sur le port " + port);
  }
});
const io = new Server(server);
// Créer les différente réponce au action demmander par les client
app.get("/",(req,res)=>{
	res.render("index.html",{});
})
//
const taille_map = 600;
let x = 0;
let vitesse = 2;
let x_direction = "+";
const canvas = createCanvas(taille_map,taille_map);
const ctx = canvas.getContext("2d",{willReadFrequently:true});
ctx.clearRect(0,0,taille_map,taille_map);
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(x,250,100,100);
  dataUrl = canvas.toDataURL();
  io.emit("image",dataUrl);
io.on("connection",(socket) => {
  console.log("ok");
  let dataUrl = canvas.toDataURL();
  socket.emit("image",dataUrl);
});
function dessin(){
  let x_bis = x + 100;
  if(x <= 0){
    x += vitesse;
    x_direction = "+";
  } else if(x >= taille_map || x_bis >= taille_map){
    x -= vitesse;
    x_direction = "-";
  } else {
    if(x_direction == "+") x += vitesse;
    else x -= vitesse;
  }

  ctx.clearRect(0, 0, taille_map, taille_map);
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(x, 250, 100, 100);
  const dataUrl = canvas.toDataURL();
  io.emit("image", dataUrl);
}
let intervalId = setInterval(()=>{
  dessin();
},20);