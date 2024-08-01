///// The Tokeniser /////
// now v2: a lot more readable

const TYPE_OPERATOR = "OPERATOR";
const TYPE_SEPARATOR = "SEPARATOR";
const TYPE_NUMBER = "NUMBER";
const TYPE_STRING = "STRING";
const TYPE_VAR = "VAR";
const TYPE_KEYWORD = "KEYWORD";

const IDENTIFIER_START_REGEX = /[A-Za-z]/;
const IDENTIFIER_CHAR_REGEX = /[A-Za-z0-9_]/;
const IDENTIFIER_REGEX = /[A-Za-z][A-z0-9_]*/;

const BRACKETS_OPERATORS_REGEX = /[\(\)\+\-\*\/\!\&\|\=\>\<\%]/;
const SPACE_BRACKETS_OPERATORS_REGEX = /[\t \(\)\+\-\*\/\!\&\|\=\>\<\%]/;
const SEPARATORS_REGEX = /,/;
const NUMBERS_REGEX = /[0-9]/;

///// Utility Functions /////
function syntaxException(msg) {
	return {
		"type": "Syntax Error",
		"message": msg
	}
}

function tokeniserError(msg) {
	return {
		"type": "Tokeniser Error",
		"message": msg
	}
}

///// Tokenising Task Functions /////
function parseString(expression, ptr) {
	/* Tester */
	if (expression[ptr++] !== "\"") {
		return null; // try next parser
	}

	/* Parser */
	let escape = false;
	let stringAccumulator = "";

	while (ptr < expression.length) {
		let c = expression[ptr++];

		if (escape) {
			stringAccumulator += c;
		} else if (c == "\"") {
			return [{
				"type": TYPE_STRING,
				"value": stringAccumulator
			}, ptr];
		} else if (c == "\\") {
			escape = true;
		} else {
			stringAccumulator += c;
		}
	}

	throw syntaxException("Unclosed string");
}

function createRegexParser(regex, type) {
	// prevent improper parsers being created
	if (!regex.source.startsWith("^")) {
		throw "Regex is missing string-start operator '^'";
	}

	return (expression, ptr) => {
		const testString = expression.substring(ptr);
		const match = regex.exec(testString);

		/* Tester */
		if (!match || match.index !== 0) {
			return null;
		}
		
		/* Parser */
		let value = testString.substring(0, match[0].length);
		return [{type, value}, ptr + match[0].length]
	};
}

// Define the handlers, in priority order
const HANDLERS = [
	parseString
];

///// Actual Tokeniser Function /////
async function tokenise(lnm, expression, keywords) {
	try {

	} catch (e) {
		if (e.type) {
			throw `${e.type} Error at line ${lnm}:\n>> ${e.message}`;
		} else {
			throw e;
		}
	}
}

// the least readable part of this code :(
async function tokenise0(lnm, expression, keywords) {
    function exception(lineNum, msg) {
        return "Syntax Error at line " + lineNum + ":\n>> " + msg;
    }

	let tokens = [];
	let varIndex = -1; // for slicing
	let stringMode = 0; // 1 = string, 2 = escape
	let numberMode = 0; // literally stringmode for numbers. 1 = can tolerate a decimal point, 2 = cannot tolerate one anymore
	let stringAccumulator = ""; // for accumulating strings or numbers

	for (let i = 0; i < expression.length; i++) {
		let c = expression[i]; // current char

		if (stringMode) {
			if (stringMode == 2) {
				// in this case we do want to add the escaped character, due to how strings are handled
				stringAccumulator += '\\' + c;
				stringMode = 1;
			}
			else if (c == '\\') {
				stringMode = 2; // escape character
			}
			else if (c == '"') {
				tokens.push({"type": "STRING", "value": stringAccumulator});
				// reset string info. string has ended!
				stringAccumulator = ""; // this has to be "" to prepare for the next one
				stringMode = 0;
			}
			else {
				stringAccumulator += c;
			}
		}
		else if (numberMode) {
			if (NUMBERS_REGEX.test(c)) {
				stringAccumulator += c;
			}
			else if (c == '.') {
				// decimal point only once!
				// tracked in the number mode
				if (numberMode == 2) {
					throw exception(lnm, "A number cannot have two decimal points!");
				}
				else {
					numberMode = 2;
					stringAccumulator += c;
				}
			}
			else if (SPACE_BRACKETS_OPERATORS_REGEX.test(c)) {
				// number ends
				tokens.push({"type": "NUMBER", "value": stringAccumulator});
				// reset number info to prepare for future use
				stringAccumulator = "";
				numberMode = 0;
				// rewind so it can be read again out of number mode
				i--;
			}
			else {
				throw exception(lnm, "Unexpected character while parsing number: \"" + c + '"');
			}
		}
		else if (varIndex > -1) {
			if (!IDENTIFIER_CHAR_REGEX.test(c)) {
				if (SPACE_BRACKETS_OPERATORS_REGEX.test(c)) {
					tokens.push({"type": "VAR", "value": expression.slice(varIndex, i)});
					varIndex = -1;
					i--; // take another look at the operator under a... different lens ;)
				}
				else {
					throw exception(lnm, "Unexpected character while parsing variable name: \"" + c + '"');
				}
			}
		}
		else if (c == ' ' || c == '\t') {
			// no-op
		}
		else {
			if (IDENTIFIER_START_REGEX.test(c)) {
				varIndex = i;
			}
			else if (BRACKETS_OPERATORS_REGEX.test(c)) {
				if (i != expression.length - 1 && (c == '>' || c == '<')) { // "defer judgement"... if it's > or < it should not be at the end but idc ur problem (not a problem for tokeniser)
					if (expression[i + 1] == '=') {
						i++; // skip 2 characters, not one, bc this is a 2 character token
						c += '='; // and add the equals to the tokenz
					}
				}

				tokens.push({"type": "OPERATOR", "value": c});
			}
			else if (c == '"') {
				stringMode = 1;
			}
			else if (NUMBERS_REGEX.test(c)) {
				numberMode = 1;
				i--; // rewind to get the number mode parser to read that instead (to prevent spaghetti by fracturing the parsers for each type)
			}
			else {
				throw exception(lnm, "Unexpected character \"" + c + '"');
			}
		}
	}

	// don't leave your strings hanging for goodness sake
	if (stringMode) {
		throw exception(lnm, "Unclosed string!");
	}

	// push any variables still being accumulated
	if (varIndex > -1) {
		tokens.push({"type": "VAR", "value": expression.slice(varIndex, expression.length)});
	}

	// push any numbers still being accumulated
	if (numberMode) {
		tokens.push({"type": "NUMBER", "value": stringAccumulator});
	}

	// detect keywords
	for (let i = 0; i < tokens.length; i++) {
		let token = tokens[i];

		if (token.type == "VAR" && keywords.indexOf(token.value) != -1) {
			token.type = "KEYWORD";
		}
	}

	return tokens;
}

module.exports = {
    tokenise
};
