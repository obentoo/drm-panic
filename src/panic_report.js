// SPDX-License-Identifier: MIT
//
// Decodes the kmsg that drm_panic packs into its QR code URL and shows it.
// Every value comes from the URL, i.e. from whoever produced the QR code: it
// is only ever inserted as text (createTextNode / textContent), never as HTML.
'use strict';

const main_div = document.getElementById('main');

/*
 * Check if the parameters are set as a url parameter or as a fragment
 */
function get_parameters() {
	const queryString = window.location.search;
	const fragString = window.location.hash.substring(1); //skip the leading #

	const urlParams = new URLSearchParams(queryString);
	const urlFragments = new URLSearchParams(fragString);

	if (urlParams.get("z") || urlParams.get("zl")) {
		return urlParams;
	}
	return urlFragments;
}

/*
 * Encoding, same as Fido2 specification.
 * v6.14+
 */
function numbers_to_data2(numbers) {
	/* 17 decimal digits are converted to 7 bytes */
	const main_len = Math.floor(numbers.length / 17) * 7;
	/* and the remainings bytes, compute the reverse of  [0, 3, 5, 8, 10, 13, 15, 17] */
	const rem_len = Math.floor((numbers.length % 17) * 2 / 5);

	const data = new Uint8Array(main_len + rem_len);
	let offset = 0;

	for (let i = 0; i < numbers.length; i += 17) {
		const chunk = numbers.substring(i, i + 17);
		let num = BigInt(chunk);
		let num_bytes = 7;
		// Upstream read chunk.len, which is undefined, so the short last chunk
		// always took the 7-byte branch. Harmless only because a Uint8Array
		// drops writes past its end; read the real length instead.
		if (chunk.length < 17) {
			num_bytes = rem_len;
		}
		for (let j = 0; j < num_bytes; j++) {
			data[offset] = Number(num % 256n);
			num = num / 256n;
			offset++;
		}
	}
	return data;
}

/*
 * Legacy encoding, found in v6.10 to v6.13
 */
function numbers_to_data(numbers) {
	const num_chars_to_bits = [0, 4, 7, 10, 13];
	const length_in_bits = Math.floor(numbers.length / 4) * 13 + num_chars_to_bits[numbers.length % 4];
	const length_in_bytes = length_in_bits / 8;
	const extra = length_in_bits % 8;
	const data = new Uint8Array(length_in_bytes);

	let offset = 0;
	let byte_off = 0;
	let rem = 0;

	for (let i = 0; i < numbers.length; i += 4) {
		const chunk = numbers.substring(i, i + 4);
		const num = Number(chunk);
		const new_length = num_chars_to_bits[chunk.length];

		let b = offset + new_length;
		if (byte_off * 8 + b >= length_in_bytes * 8) {
			b -= extra;
		}
		if (b < 8) {
			rem += num << (8 - b);
			offset = b;
		} else if (b < 16) {
			data[byte_off] = rem + (num >> (b - 8));
			byte_off++;
			rem = (num << (16 - b)) & 0xff;
			offset = (b - 8);
		} else {
			data[byte_off] = rem + (num >> (b - 8));
			byte_off++;
			data[byte_off] = num >> (b - 16);
			byte_off++;
			rem = num << (24 - b) & 0xff;
			offset = (b - 16);
		}
	}
	return data;
}

let report_text = "";

function add_info(name, value) {
	if (value) {
		const div = document.createElement("div");
		const n = document.createElement("b");
		n.textContent = name + ": ";
		div.appendChild(n);
		div.appendChild(document.createTextNode(value));
		main_div.appendChild(div);
		report_text += name + ": " + value + "\n";
	}
}

function add_error(message) {
	const p = document.createElement("p");
	p.className = "error";
	p.textContent = message;
	main_div.appendChild(p);
}

function add_data(data) {
	const uncompressed = pako.inflate(data);
	// pako returns undefined, without throwing, on truncated input.
	if (!uncompressed || uncompressed.length === 0) {
		throw new Error("incomplete compressed data");
	}
	// kmsg is UTF-8; String.fromCharCode.apply would also overflow the call
	// stack on a large report.
	const text = new TextDecoder("utf-8").decode(uncompressed);

	const kmsg = document.createElement("pre");
	kmsg.textContent = text;
	main_div.appendChild(kmsg);
	report_text += "\n" + text;
}

const params = get_parameters();

add_info("Arch", params.get("a"));
add_info("Version", params.get("v"));
add_info("Distribution", params.get("d"));

const numbers = params.get("z");
const legacy_numbers = params.get("zl");
const digits = numbers || legacy_numbers;

if (!digits) {
	add_error("No panic data in this address. Open it by scanning the QR code on the panic screen.");
} else if (!/^[0-9]+$/.test(digits)) {
	add_error("The panic data is damaged: it must contain digits only.");
} else {
	try {
		add_data(numbers ? numbers_to_data2(numbers) : numbers_to_data(legacy_numbers));
		document.getElementById("actions").hidden = false;
		document.getElementById("copy").addEventListener("click", () => {
			navigator.clipboard.writeText(report_text);
		});
	} catch (e) {
		add_error("The panic data could not be decoded (" + e + "). The QR code may have been scanned incompletely.");
	}
}
