'use strict';

require('dotenv').config();
const chalk = require('chalk');
const fs = require('fs');

const minecraftDirectory = process.env.APPDATA.replace(/\\/g, "/") + '/.minecraft';
const texturePackDirectory = minecraftDirectory + '/resourcepacks';
const errorColor = chalk.bold.red;
const successColor = chalk.green;
const filePathColor = chalk.bgRgb(21, 101, 192).white;
const linkColor = chalk.underline;

checkIfMinecraftInstalled();

function checkIfMinecraftInstalled() {
	console.log('Checking if minecraft is installed');
	fs.access(minecraftDirectory, fs.constants.X_OK | fs.constants.W_OK, (err1) => {
		if (err1) {
			console.error(filePathColor(minecraftDirectory) + ' ' + (err1.code === 'ENOENT' ? errorColor("doesn't exist") : errorColor('is read-only')));
		} else {
			console.log(successColor('Found minecraft folder at ' + filePathColor(minecraftDirectory)));
			checkIfTexturePackFolderGood();
		}
	});
}

function checkIfTexturePackFolderGood() {
	console.log('Checking if texture pack folder exists');
	fs.access(texturePackDirectory, fs.constants.X_OK | fs.constants.W_OK, (err1) => {
		if (err1) {
			console.error(filePathColor(texturePackDirectory) + ' ' + (err1.code === 'ENOENT' ? errorColor("doesn't exist") : errorColor('is read-only')));
		} else {
			console.log(successColor('Found texture pack folder at ' + filePathColor(texturePackDirectory)));
			checkIfPATavailable();
		}
	});
}

function checkIfPATavailable() {
	console.log('Checking if personal access token for gitlab is set');
	if (process.env.GITLAB_PAT) {
		console.log(successColor('got it'));
	} else {
		console.log(errorColor('none found'));
		fs.access('./.env', fs.constants.W_OK, (err1) => {
			if (err1) {
				if (err1.code === 'ENOENT') {
					// Create file
					getUserPAT(true);
				} else {
					console.error(errorColor('is read-only'));
				}
			} else {
				getUserPAT();
			}
		});
	}
}

const rl = require('readline');

function getUserPAT(createFile = false) {
	const terminalLink = require('terminal-link');
	const r1 = rl.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	console.log('To get higher res (256x, 512x, 1024x, 2048x) textures, you ' + terminalLink('donate', 'https://continuum.graphics/stratum-rp') + ". Once you do, you must create a personal access token with the scope 'api' for this program to connect. You can do so under " + terminalLink('User Settings > Access Tokens', 'https://dl.continuum.graphics/profile/personal_access_tokens'));
	console.log("If you'd prefer the free 128x version, simply leave the following blank");
	r1.question('Personal Access Token:', (answer) => {
		processPat(answer.trim());

		r1.close();
		process.stdin.destroy();
	});

	function processPat(pat) {
		fs.readFile((!createFile ? './.env' : './.env.sample'), { encoding: 'utf8' }, (err1, data1) => {
			if (err1) throw err1;

			const editor = /(?<=GITLAB\_PAT\=).*/;
			const newEnvFile = data1.replace(editor, pat);

			fs.writeFile('./.env', newEnvFile, (err2) => {
				if (err2) throw err2;

				getListOfSizes();
			});
		});
	}
}

const request = require('request');

function getListOfSizes() {
	request.get({
		url: 'https://dl.continuum.graphics/api/v4/projects/',
		headers: {
			'Private-Token': process.env.GITLAB_PAT || ''
		}
	}, function (error, response, body) {
		if (error) throw error;

		let stratumVersions = [];
		JSON.parse(body).map(function (project) {
			const validProjectNames = /^Stratum\-\d+x$/;
			if (validProjectNames.test(project.name)) {
				stratumVersions.push(project);
			}
		});
	});

}
