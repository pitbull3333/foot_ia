const {
  express,
  fs,
  bodyParser,
  Server,
  createCanvas,
  cors,
  tf,
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
// Crée le réseau de neurones
function createModel(){
  const model = tf.sequential();
  model.add(tf.layers.dense({inputShape:[2],units:20,activation:"relu"}));// inputShape 2 entrée, units 20 neurone pour la premiaire couche
  model.add(tf.layers.dense({units:20,activation:"relu"}));// units 20 neurone pour la deuxieme couche
  model.add(tf.layers.dense({units:actions.length,activation:"linear"}));// units actions.length actions possibles
  model.compile({ optimizer:"adam",loss:"meanSquaredError"});
  return model;
}
// Définir les actions possibles
const actions = [
  {direction_r1_deg:0,vitesse:0},
  {direction_r1_deg:45,vitesse:0},
  {direction_r1_deg:90,vitesse:0},
  {direction_r1_deg:135,vitesse:0},
  {direction_r1_deg:180,vitesse:0},
  {direction_r1_deg:225,vitesse:0},
  {direction_r1_deg:270,vitesse:0},
  {direction_r1_deg:315,vitesse:0},
  {direction_r1_deg:0,vitesse:1},
  {direction_r1_deg:45,vitesse:1},
  {direction_r1_deg:90,vitesse:1},
  {direction_r1_deg:135,vitesse:1},
  {direction_r1_deg:180,vitesse:1},
  {direction_r1_deg:225,vitesse:1},
  {direction_r1_deg:270,vitesse:1},
  {direction_r1_deg:315,vitesse:1},
];
// Créer une récompense
function getReward(x, y) {
  const objectifX = 900;
  const objectifY = 20;

  // Distance euclidienne à l’objectif
  const distance = Math.sqrt((x - objectifX) ** 2 + (y - objectifY) ** 2);

  // Plus la distance est faible, plus la récompense est haute
  // On retourne la valeur négative de la distance pour que le robot apprenne à la minimiser
  const reward = -distance;

  return reward;
}
//
const longueur_terrain = 1200;
const largeur_terrain = longueur_terrain / 1.75;
const rayon_robot = largeur_terrain / 35;
//let vitesse_robot = 0.5;//4
let vitesse = 0;
let xr1 = largeur_terrain / 2;
let yr1 = longueur_terrain / 2;
let direction_r1_deg = 135;// 0 = horizontal gauche en sens inverce des éguille d'une montre
//const direction_r1_rad = direction_r1_deg * (Math.PI / 180);
const canvas = createCanvas(largeur_terrain,longueur_terrain);
const ctx = canvas.getContext("2d",{willReadFrequently:true});
dataUrl = canvas.toDataURL();
io.emit("image",dataUrl);
io.on("connection",(socket) => {
  let dataUrl = canvas.toDataURL();
  socket.emit("image",dataUrl);
});
function dessin(){
  ctx.clearRect(0,0,largeur_terrain,longueur_terrain);
  // Dessine la ligne mediane
  ctx.beginPath();
  ctx.moveTo(0,longueur_terrain / 2);
  ctx.lineTo(largeur_terrain,longueur_terrain / 2);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.stroke();
  // Dessine le point au milieu du terin
  ctx.beginPath();
  ctx.fillStyle = "white";
  ctx.arc(largeur_terrain / 2,longueur_terrain / 2,largeur_terrain / 70,0,Math.PI * 2);
  ctx.fill();
  // Dessine les lignes de but
  ctx.beginPath();
  ctx.moveTo((largeur_terrain / 2) - 20,0);
  ctx.lineTo((largeur_terrain / 2) + 20,0);
  ctx.strokeStyle = "red";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo((largeur_terrain / 2) - 20,longueur_terrain);
  ctx.lineTo((largeur_terrain / 2) + 20,longueur_terrain);
  ctx.strokeStyle = "blue";
  ctx.lineWidth = 4;
  ctx.stroke();
  // Dessine le robot
  ctx.beginPath();
  ctx.fillStyle = "#f00";
  ctx.arc(xr1,yr1,rayon_robot,0,Math.PI * 2);
  ctx.fill();
  const dataUrl = canvas.toDataURL();
  io.emit("image",dataUrl);
  // Calcule de xr1 yr1
  //coefficient_r1_x = Math.cos(direction_r1_rad);
  //coefficient_r1_y = Math.sin(direction_r1_rad);
  //xr1 = xr1 - vitesse_r1 * coefficient_r1_x;
  //yr1 = yr1 + vitesse_r1 * coefficient_r1_y;
  // Empêche de sortir du terrain
  if((xr1 + rayon_robot) >= largeur_terrain){
    xr1 = largeur_terrain - rayon_robot;
  }
  if((xr1 - rayon_robot) <= 0){
    xr1 = rayon_robot;
  }
  if((yr1 - rayon_robot) <= 0){
    yr1 = rayon_robot;
  }
  if((yr1 + rayon_robot) >= longueur_terrain){
    yr1 = longueur_terrain - rayon_robot;
  }
}

//
const model = createModel();
let explorationRate = 1.0;
const explorationDecay = 0.995;
const explorationMin = 0.1;
const discountFactor = 0.9;

// Choisir une action (exploration ou exploitation)
function chooseAction(state) {
  if (Math.random() < explorationRate) {
    return Math.floor(Math.random() * actions.length); // aléatoire
  } else {
    const inputTensor = tf.tensor2d([state]);
    const prediction = model.predict(inputTensor);
    const actionIndex = prediction.argMax(1).dataSync()[0];
    inputTensor.dispose();
    prediction.dispose();
    return actionIndex;
  }
}

//let intervalId = setInterval(()=>{
let intervalId = setInterval(async () => {
  // État courant (normalisé)
  const state = [xr1 / largeur_terrain, yr1 / longueur_terrain];

  // Choix de l'action
  const actionIndex = chooseAction(state);
  const action = actions[actionIndex];

  // Appliquer l'action
  direction_r1_deg = action.direction_r1_deg;
  vitesse_r1 = action.vitesse;

  // Déplacement
  const direction_r1_rad = direction_r1_deg * (Math.PI / 180);
  const coeffX = Math.cos(direction_r1_rad);
  const coeffY = Math.sin(direction_r1_rad);
  xr1 -= vitesse_r1 * coeffX;
  yr1 += vitesse_r1 * coeffY;

  // Empêche de sortir du terrain
  //xr1 = Math.max(rayon_robot, Math.min(largeur_terrain - rayon_robot, xr1));
  //yr1 = Math.max(rayon_robot, Math.min(longueur_terrain - rayon_robot, yr1));

  // Nouvel état et récompense
  const newState = [xr1 / largeur_terrain, yr1 / longueur_terrain];
  const reward = getReward(xr1, yr1);

  // Prédiction Q-values
  const oldQ = model.predict(tf.tensor2d([state]));
  const newQ = model.predict(tf.tensor2d([newState]));

  const oldQValues = oldQ.dataSync();
  const newQValues = newQ.dataSync();

  const targetQ = [...oldQValues];
  const bestFutureQ = Math.max(...newQValues);
  targetQ[actionIndex] = reward + discountFactor * bestFutureQ;

  await model.fit(
    tf.tensor2d([state]),
    tf.tensor2d([targetQ]),
    { epochs: 1, verbose: 0 }
  );

  oldQ.dispose();
  newQ.dispose();

  // Mise à jour exploration
  if (explorationRate > explorationMin) {
    explorationRate *= explorationDecay;
  }

  // Affichage
  dessin();

  // Reset si l’objectif est atteint
  const distance = Math.sqrt((xr1 - 900) ** 2 + (yr1 - 20) ** 2);
  if (distance < 10) {
    xr1 = largeur_terrain / 2;
    yr1 = longueur_terrain / 2;
    vitesse_r1 = 0;
    direction_r1_deg = 135;
    console.log("Objectif atteint ! Reset position.");
  }
},20);