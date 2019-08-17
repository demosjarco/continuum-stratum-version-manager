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
		getListOfSizes();
	} else {
		console.log(errorColor('none found'));
		fs.access('./.env', fs.constants.W_OK, (err1) => {
			if (err1) {
				if (err1.code === 'ENOENT') {
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

	console.log('To get higher res (256x, 512x, 1024x, 2048x) textures, you have to ' + terminalLink('donate', 'https://continuum.graphics/stratum-rp') + ". Once you do, you must create a personal access token with the scope 'api' for this program to connect. You can do so under " + terminalLink('User Settings > Access Tokens', 'https://dl.continuum.graphics/profile/personal_access_tokens'));
	console.log("If you'd prefer the free 128x version, simply leave the following blank");
	r1.question('Personal Access Token: ', (answer) => {
		processPat(answer.trim());

		r1.close();
	});

	function processPat(pat) {
		process.env.GITLAB_PAT = pat;
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
let stratumVersions = [];

function getListOfSizes() {
	request.get({
		url: 'https://dl.continuum.graphics/api/v4/projects/',
		headers: {
			'Private-Token': process.env.GITLAB_PAT || ''
		}
	}, function (error, response, body) {
		if (error) throw error;

		JSON.parse(body).map(function (project) {
			const validProjectNames = /^Stratum\-\d+x$/;
			if (validProjectNames.test(project.name)) {
				stratumVersions.push(project);
			}
		});

		askSizes();
	});

}

function askSizes() {
	const r1 = rl.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	console.log('Select a version to download. If left blank, it will download the highest res version');
	let question = '';
	stratumVersions.map(function (versions, index) {
		question += '[' + index + '] ' + versions.name + '\n';
	});
	question += 'Type the corresponding number: ';
	r1.question(question, (answer) => {
		const version = Number.isNaN(parseInt(answer)) ? (stratumVersions.length - 1) : parseInt(answer);
		console.log(successColor('Installing ' + stratumVersions[version].name));
		installStratum(version, stratumVersions[version].name);

		r1.close();
	});
	r1.once('close', () => {
		process.stdin.destroy();
	});
}

const oldFolderReg = /^Stratum\-\d+x\-master(\-(\w|\d)+)?$/i;

function installStratum(version, name) {
	console.log('Checking for old stratum to remove');

	fs.readdir(texturePackDirectory, function (err, files) {
		if (err) throw err;

		let exists = false;
		files.forEach(function (fileName) {
			if (oldFolderReg.test(fileName)) {
				exists = true;
				console.log('Deleting old stratum version');
				require('rimraf')(texturePackDirectory + '/' + fileName + '/', function (err2) {
					if (err2) throw err2;

					console.log(successColor('Deleted old stratum version'));
					downloadStratum('https://dl.continuum.graphics/api/v4/projects/' + stratumVersions[version].id + '/repository/archive.zip');
				});
			}
		});
		if (!exists) {
			console.log(successColor('No old version detected'));
			downloadStratum('https://dl.continuum.graphics/api/v4/projects/' + stratumVersions[version].id + '/repository/archive.zip');
		}
	});

	function downloadStratum(link) {
		console.log('Downloading stratum zip');
		const fileNameReg = /(?<=htt(p:|ps:)\/\/dl\.continuum\.graphics\/api\/v4\/projects\/\d+\/repository\/)\w+(?=\.zip)/;
		const newFileName = name + '-master.zip';
		let fileSize = 0;
		let downloadedSize = 0;
		const ProgressBar = require("./ProgressBar");
		const Bar = new ProgressBar();

		if (fileNameReg.test(link)) {
			request({
				url: link.replace(/http(?!s)/g, "https"),
				headers: {
					'Private-Token': process.env.GITLAB_PAT || ''
				}
			}).on('response', function (response) {
				fileSize = Number(response.headers['content-length']);
				Bar.init(fileSize);
			}).once("error", (error) => {
				console.error(error)
			}).on('data', function (chunk) {
				downloadedSize += Number(chunk.length);
				Bar.update(downloadedSize);
			}).once('close', function () {
				console.log(successColor('Downloaded stratum archive'));
			}).pipe(fs.createWriteStream(texturePackDirectory + '/' + newFileName).once('close', () => {
				const AdmZip = require('adm-zip');
				let zip = new AdmZip(texturePackDirectory + '/' + newFileName);
				zip.extractAllTo(texturePackDirectory + '/', true);
				console.log('Extracted stratum archive');
				fs.unlink(texturePackDirectory + '/' + newFileName, (err) => {
					if (err) throw err;
					console.log(successColor('Deleted stratum archive'));
				});
				fs.readdir(texturePackDirectory, function (err, files) {
					if (err) throw err;

					files.forEach(function (fileName) {
						if (oldFolderReg.test(fileName)) {
							fs.rename(texturePackDirectory + '/' + fileName + '/', texturePackDirectory + '/' + name + '-master/', (err2) => {
								if (err2) throw err2;

								console.log(successColor('Renamed stratum folder'));
							});
						}
					});
				});
			}));
		}
	}
}