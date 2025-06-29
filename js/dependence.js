const express=require("express");
const fs=require("fs");
const bodyParser=require("body-parser");
const {Server} = require('socket.io');
const {createCanvas}=require("canvas");
const cors = require("cors");
const tf = require("@tensorflow/tfjs");
module.exports = {
	express,
	fs,
	bodyParser,
	Server,
	createCanvas,
	cors,
	tf,
};