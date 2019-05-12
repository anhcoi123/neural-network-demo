import { Visualization } from "./Visualization";
import Simulation from "../Simulation";
import * as $ from "jquery";
import { int, double } from "../main";
import Net from "../Net";
import * as vis from "vis";
interface Point3d {
	x: double;
	y: double;
	z: double;
	style?: double;
}
/**
 * Visualization that displays all the weights in the network as a black-white gradient
 *
 * hidden when in perceptron mode because then it's pretty boring
 */
export default class WeightsGraph implements Visualization {
	default_redrawBarSizeGraphPoint: any;
	actions = ["Weights"];
	container = document.createElement("div");
	offsetBetweenLayers = 1;
	graph: any; //vis.Graph3d;
	xyToConnection: { [xcommay: string]: [Net.NeuronConnection, int] } = {};
	constructor(public sim: Simulation) {
		// Save default _redrawBarSizeGraphPoint method for later use
		this.default_redrawBarSizeGraphPoint =
			vis.Graph3d.prototype._redrawBarSizeGraphPoint;
		// hack to get grayscale colors
		vis.Graph3d.prototype._hsv2rgb = (h: double, s: double, v: double) => {
			h = Math.min(h, 250) | 0;
			return "rgb(" + [h, h, h] + ")";
		};
		console.log("Create graph");
		// hack to disable axis drawing
		vis.Graph3d.prototype._redrawAxis = function() {};
		this.graph = new vis.Graph3d(this.container, undefined, {
			style: "bar-size",
			showPerspective: false,
			cameraPosition: { horizontal: -0.001, vertical: Math.PI / 2 },
			width: "100%",
			height: "100%",
			xLabel: "Layer",
			yLabel: "Neuron",
			zLabel: "",
			//zStep: 0.1,
			showGrid: true,
			axisColor: "red",
			xBarWidth: 1, //0.9,
			yBarWidth: 1, //0.9,
			xCenter: "50%",
			legendLabel: "Weight",
			zMin: -0.5,
			zMax: 0.5,
			tooltip: (point: Point3d) => {
				const [conn, outputLayer] = this.xyToConnection[
					point.x + "," + point.y
				];
				const inLayer = outputLayer - 1;
				let inStr: string, outStr: string;
				const inN = conn.inp,
					outN = conn.out;
				if (inN instanceof Net.InputNeuron) inStr = inN.name;
				else inStr = `Hidden(${inLayer + 1},${inN.layerIndex + 1})`;
				if (outN instanceof Net.OutputNeuron) outStr = outN.name;
				else
					outStr = `Hidden(${outputLayer + 1},${outN.layerIndex +
						1})`;
				return inStr + " to " + outStr + ": " + point.z.toFixed(2); //conn.weight.toFixed(2);
			},
			//xValueLabel: (x: int) => this.xToLayer[x] || "",
			yValueLabel: (y: int) => ((y | 0) == y ? y + 1 : ""),
			zValueLabel: (z: int) => ""
		});
	}
	// Hack redrawBar to draw matrix for TDNN Weight Matrix
	_redrawBarSizeGraphPoint = (ctx: any, point: any) => {
		// calculate size for the bar
		var fraction =
			(Math.abs(point.point.z) - this.graph.valueRange.min) /
			this.graph.valueRange.range();
		var xWidth = (this.graph.xBarWidth / 2) * (fraction * 0.8 + 0.2);
		var yWidth = (this.graph.yBarWidth / 2) * (fraction * 0.8 + 0.2);

		var hueBlack = 255;
		var hueWhite = 0;
		var colors =
			point.point.z < 0
				? "rgb(" + [hueBlack, hueBlack, hueBlack] + ")"
				: "rgb(" + [hueWhite, hueWhite, hueWhite] + ")";

		this.graph._redrawBar(
			ctx,
			point,
			xWidth,
			yWidth,
			colors,
			this.graph.dataColor.stroke
		);
	};
	onView(previouslyHidden: boolean, action: int) {
		this.graph.redraw();
	}
	onHide() {}
	parseDataTDNN(net: Net.NeuralNet) {
		this.xyToConnection = {};
		const data: Point3d[] = [];
		let maxx = 0;
		let maxy = 0;
		let lastUpdate = 1;
		const maxHeight = Math.max.apply(
			null,
			net.layers.map(layer => layer.length)
		);
		for (
			let inputLayer = 0;
			inputLayer < net.layers.length - 2;
			inputLayer++
		) {
			const layer = net.layers[inputLayer];
			const layerY = maxy + this.offsetBetweenLayers;

			for (
				let inputNeuron = 0;
				inputNeuron < layer.length;
				inputNeuron++
			) {
				let layerX = 0;
				const inN = layer[inputNeuron];
				maxy = Math.max(maxy, layerY + layer.length - 2);
				for (
					let outputNeuron = 0;
					outputNeuron < inN.outputs.length;
					outputNeuron++
				) {
					const conn = inN.outputs[outputNeuron];
					const outN = conn.out;
					if (conn.weightVector != undefined) {
						layerX = (conn.weightVector!.length + 1) * outputNeuron;
						maxx = Math.max(
							maxx,
							layerX + conn.weightVector!.length
						);
						if (
							!this.sim.state.bias &&
							outN instanceof Net.InputNeuron &&
							outN.constant
						) {
							continue;
						}
						for (
							let timeDelayWeight = 0;
							timeDelayWeight < conn.weightVector!.length;
							timeDelayWeight++
						) {
							const p = {
								x: layerX + timeDelayWeight,
								y: layerY + inputNeuron,
								z: conn.weightVector![timeDelayWeight],
								style: conn.weightVector![timeDelayWeight]
							};
							if (maxHeight != layer.length)
								p.y += (maxHeight - layer.length) / 2;
							data.push(p);
							this.xyToConnection[p.x + "," + p.y] = [
								conn,
								inputLayer
							];
						}
					} else {
						layerX = outputNeuron;
						const p = {
							x: layerX,
							y: layerY + inputNeuron,
							z: conn.weight,
							style: conn.weight
						};
						if (maxHeight != layer.length)
							p.y += (maxHeight - layer.length) / 2;
						data.push(p);
						this.xyToConnection[p.x + "," + p.y] = [
							conn,
							inputLayer
						];
					}
				}
			}
		}
		return data;
	}
	/** parse network layout into weights graph ordering */
	parseData(net: Net.NeuralNet) {
		console.log(this.sim.tdnngraph.alreadySetNet);
		if (net.isTDNN) {
			// Switch to weightMatrix for TDNN
			var options = {
				style: "bar-size"
			};
			vis.Graph3d.prototype._redrawBarSizeGraphPoint = this._redrawBarSizeGraphPoint;
			this.graph.setOptions(options);
			let data1: Point3d[] = [{ x: 1, y: 1, z: 0, style: 0 }];
			try {
				data1 = this.parseDataTDNN(net);
				console.log(data1);
				return data1;
			} catch {
				console.log(data1);
				return data1;
			}
		}
		// Switch to normal weightMatrix
		vis.Graph3d.prototype._redrawBarSizeGraphPoint = this.default_redrawBarSizeGraphPoint;
		var options = {
			style: "bar"
		};
		this.graph.setOptions(options);
		this.xyToConnection = {};
		const data: Point3d[] = [];
		let maxx = 0;
		const maxHeight = Math.max.apply(
			null,
			net.layers.map(layer => layer.length)
		);
		for (
			let outputLayer = 1;
			outputLayer < net.layers.length;
			outputLayer++
		) {
			const layer = net.layers[outputLayer];
			const layerX = maxx + this.offsetBetweenLayers;
			for (
				let outputNeuron = 0;
				outputNeuron < layer.length;
				outputNeuron++
			) {
				const outN = layer[outputNeuron];
				maxx = Math.max(maxx, layerX + outN.inputs.length);
				for (
					let inputNeuron = 0;
					inputNeuron < outN.inputs.length;
					inputNeuron++
				) {
					const conn = outN.inputs[inputNeuron];
					const inN = conn.inp;
					if (
						!this.sim.state.bias &&
						inN instanceof Net.InputNeuron &&
						inN.constant
					) {
						continue;
					}
					const p = {
						x: layerX + inputNeuron,
						y: outputNeuron,
						z: conn.weight
					};
					if (maxHeight != layer.length)
						p.y += (maxHeight - layer.length) / 2;
					data.push(p);
					this.xyToConnection[p.x + "," + p.y] = [conn, outputLayer];
				}
			}
		}
		return data;
	}
	onNetworkLoaded(net: Net.NeuralNet) {
		if (
			this.sim.state.type == "perceptron" ||
			!this.sim.net.weightSharing
		) {
			this.actions = [];
			return;
		} else this.actions = ["Weights"];
		this.xyToConnection = {};
		this.graph.setData(this.parseData(net));
	}
	onFrame() {
		if (this.actions == []) return;
		this.xyToConnection = {};
		this.graph.redraw();
		this.graph.setData(this.parseData(this.sim.net));
	}
}
