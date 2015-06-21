///<reference path='Transform.ts' />
interface TrainingData {
	input: double[]; output: double[];
}

class NetworkVisualization {
	ctx: CanvasRenderingContext2D;
	mouseDownTime = 0; // ignore clicks if dragged
	colors = {
		bg: ["#f88", "#8f8"],
		fg: ["#f00", "#0f0"],
		gradient: (val: number) => "rgb(" +
			[(((1 - val) * (256-60)) | 0) + 60, ((val * (256-60)) | 0) + 60, 60] + ")"
	}

	constructor(
		public canvas: HTMLCanvasElement,
		public trafo: Transform, public sim: Simulation,
		public netOutput: (x: double, y: double) => double,
		public backgroundResolution: int) {
		this.ctx = <CanvasRenderingContext2D>this.canvas.getContext('2d');
		this.canvasResized();
		window.addEventListener('resize', this.canvasResized.bind(this));
		canvas.addEventListener("click", this.canvasClicked.bind(this));
		canvas.addEventListener("mousedown", () => this.mouseDownTime = Date.now());
		canvas.addEventListener("contextmenu", this.canvasClicked.bind(this));
	}
	draw() {
		this.drawBackground();
		this.drawCoordinateSystem();
		this.drawDataPoints();
	}

	drawDataPoints() {
		this.ctx.strokeStyle = "#000";
		if (this.sim.config.simType === SimulationType.BinaryClassification) {
			for (let val of this.sim.config.data) {
				this.drawDataPoint(val.input[0], val.input[1], val.output[0]);
			}
		} else if (this.sim.config.simType === SimulationType.AutoEncoder) {
			for (let val of this.sim.config.data) {
				let ix = val.input[0], iy = val.input[1];
				let out = this.sim.net.getOutput(val.input);
				let ox = out[0], oy = out[1];
				this.drawLine(ix, iy, ox, oy, "black");
				this.drawDataPoint(ix, iy, 1);
				this.drawDataPoint(ox, oy, 0);
			}
		} else {
			throw "can't draw this"
		}
	}
	
	drawLine(x:double, y:double, x2:double, y2:double, color:string) {
		x = this.trafo.toCanvas.x(x); x2 = this.trafo.toCanvas.x(x2);
		y = this.trafo.toCanvas.y(y); y2 = this.trafo.toCanvas.y(y2);
		this.ctx.strokeStyle = color;
		this.ctx.beginPath();
		this.ctx.moveTo(x, y);
		this.ctx.lineTo(x2, y2);
		this.ctx.stroke();
	}

	drawDataPoint(x: double, y: double, label: int) {
		x = this.trafo.toCanvas.x(x); y = this.trafo.toCanvas.y(y);
		this.ctx.fillStyle = this.colors.fg[label | 0];
		this.ctx.beginPath();
		this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
		this.ctx.fill();
		this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
		this.ctx.stroke();
	}
	drawBackground() {
		if (this.sim.config.simType == SimulationType.AutoEncoder) {
			this.ctx.fillStyle = "white";
			this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
			return;
		}
		for (let x = 0; x < this.canvas.width; x += this.backgroundResolution) {
			for (let y = 0; y < this.canvas.height; y += this.backgroundResolution) {
				let val = this.netOutput(this.trafo.toReal.x(x), this.trafo.toReal.y(y));

				if (this.sim.config.showGradient) {
					this.ctx.fillStyle = this.colors.gradient(val);
				} else this.ctx.fillStyle = this.colors.bg[+(val > 0.5)];
				this.ctx.fillRect(x, y, this.backgroundResolution, this.backgroundResolution);
			}
		}
	}
	drawCoordinateSystem() {
		let marklen = 0.2;
		let ctx = this.ctx, toc = this.trafo.toCanvas;
		ctx.strokeStyle = "#000";
		ctx.fillStyle = "#000";
		ctx.textBaseline = "middle";
		ctx.textAlign = "center";
		ctx.font = "20px monospace";
		ctx.beginPath();

		ctx.moveTo(toc.x(0), 0);
		ctx.lineTo(toc.x(0), this.canvas.height);

		ctx.moveTo(toc.x(-marklen / 2), toc.y(1));
		ctx.lineTo(toc.x(marklen / 2), toc.y(1));
		ctx.fillText("1", toc.x(-marklen), toc.y(1));

		ctx.moveTo(0, toc.y(0));
		ctx.lineTo(this.canvas.width, toc.y(0));

		ctx.moveTo(toc.x(1), toc.y(-marklen / 2));
		ctx.lineTo(toc.x(1), toc.y(marklen / 2));
		ctx.fillText("1", toc.x(1), toc.y(-marklen));
		ctx.stroke();
	}
	canvasResized() {
		this.canvas.width = $(this.canvas).width();
		this.canvas.height = $(this.canvas).height();
	}
	canvasClicked(evt: MouseEvent) {
		if ((Date.now() - this.mouseDownTime) > 200) return;
		if (this.sim.config.netLayers[0].neuronCount !== 2) {
			throw "data modification not supported for !=2 inputs";
		}
		let data = this.sim.config.data;
		let rect = this.canvas.getBoundingClientRect();
		let x = this.trafo.toReal.x(evt.clientX - rect.left);
		let y = this.trafo.toReal.y(evt.clientY - rect.top);
		if (evt.button == 2 || evt.shiftKey) {
			//remove nearest
			let nearestDist = Infinity, nearest = -1;
			for (let i = 0; i < data.length; i++) {
				let p = data[i];
				let dx = p.input[0] - x, dy = p.input[1] - y, dist = dx * dx + dy * dy;
				if (dist < nearestDist) nearest = i, nearestDist = dist;
			}
			if (nearest >= 0) data.splice(nearest, 1);
		} else {
			if (this.sim.config.simType == SimulationType.AutoEncoder) {
				data.push({ input: [x, y], output: [x, y] });
			} else if (this.sim.config.simType == SimulationType.BinaryClassification) {
				let label = evt.button == 0 ? 0 : 1;
				if (evt.ctrlKey || evt.metaKey || evt.altKey) label = label == 0 ? 1 : 0;
				data.push({ input: [x, y], output: [label] });
			}
		}
		this.draw();
		evt.preventDefault();
	}
}