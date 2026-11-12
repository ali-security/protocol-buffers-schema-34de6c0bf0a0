var tape = require('tape')
var path = require('path')
var fs = require('fs')
var schema = require('../')

var fixture = function (name) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8')
}

tape('basic parse', function (t) {
  t.same(schema.parse(fixture('basic.proto')), require('./fixtures/basic.json'))
  t.end()
})

tape('basic parse + stringify', function (t) {
  var syntax = 'syntax = "proto3";\n\n'
  t.same(schema.stringify(schema.parse(fixture('basic.proto'))), syntax + fixture('basic.proto'))
  t.end()
})

tape('complex parse', function (t) {
  t.same(schema.parse(fixture('complex.proto')), require('./fixtures/complex.json'))
  t.end()
})

tape('complex parse + stringify', function (t) {
  var syntax = 'syntax = "proto3";\n\n'
  t.same(schema.stringify(schema.parse(fixture('complex.proto'))), syntax + fixture('complex.proto'))
  t.end()
})

tape('throws on invalid', function (t) {
  t.plan(2)
  try {
    schema.parse('hello world')
  } catch (err) {
    t.ok(true, 'should fail')
  }
  try {
    schema.parse('message Foo { lol }')
  } catch (err) {
    t.ok(true, 'should fail')
  }
})

tape('comments parse', function (t) {
  t.same(schema.parse(fixture('comments.proto')), require('./fixtures/comments.json'))
  t.end()
})

tape('schema with imports', function (t) {
  t.same(schema.parse(fixture('search.proto')), require('./fixtures/search.json'))
  t.end()
})

tape('schema with imports loaded by path', function (t) {
  t.same(schema.parse(fixture('search.proto')), require('./fixtures/search.json'))
  t.end()
})

tape('schema with extends', function (t) {
  t.same(schema.parse(fixture('extend.proto')), require('./fixtures/extend.json'))
  t.end()
})

tape('comparing extended and not extended schema', function (t) {
  var sch = schema.parse(fixture('extend.proto'))
  t.same(sch.messages.MsgNormal, sch.messages.MsgExtend)
  t.end()
})

tape('schema with oneof', function (t) {
  t.same(schema.parse(fixture('oneof.proto')), require('./fixtures/oneof.json'))
  t.end()
})

tape('schema with map', function (t) {
  t.same(schema.parse(fixture('map.proto')), require('./fixtures/map.json'))
  t.end()
})

tape('schema with syntax version', function (t) {
  t.same(schema.parse(fixture('version.proto')), require('./fixtures/version.json'))
  t.end()
})

tape('throws on misplaced syntax version', function (t) {
  t.plan(1)
  try {
    schema.parse('message Foo { required int32 a = 1; }\n syntax = "proto3"')
  } catch (err) {
    t.ok(true, 'should fail')
  }
})

tape('schema with reserved characters in options', function (t) {
  t.same(schema.parse(fixture('options.proto')), require('./fixtures/options.json'))
  t.end()
})

tape('service parse', function (t) {
  t.same(schema.parse(fixture('service.proto')), require('./fixtures/service.json'))
  t.end()
})

tape('service parse + stringify', function (t) {
  var syntax = 'syntax = "proto3";\n\n'
  t.same(schema.stringify(schema.parse(fixture('service.proto'))), syntax + fixture('service.proto'))
  t.end()
})

tape('enums with options', function (t) {
  t.same(schema.parse(fixture('enum.proto')), require('./fixtures/enum.json'))
  t.end()
})

tape('fail on no tags', function (t) {
  t.throws(function () {
    schema.parse(fixture('no-tags.proto'))
  })
  t.end()
})

tape('reserved', function (t) {
  t.same(schema.parse(fixture('reserved.proto')), require('./fixtures/reserved.json'))
  t.end()
})

tape('varint, 64-bit and 32-bit wire types can be packed', function (t) {
  t.doesNotThrow(function () {
    schema.parse(fixture('valid-packed.proto'))
  }, 'should not throw')
  t.end()
})

tape('non-primitive packed should throw', function (t) {
  t.throws(function () {
    schema.parse(fixture('pheromon-trajectories.proto'))
  }, 'should throw')
  t.end()
})

tape('custom options parse', function (t) {
  t.same(schema.parse(fixture('option.proto')), require('./fixtures/option.json'))
  t.end()
})

tape('escaped quotes in option value parse', function (t) {
  t.same(schema.parse(fixture('escaped-quotes.proto')), require('./fixtures/escaped-quotes.json'))
  t.end()
})

var PROTO_KEY = '__proto__'

// engines predating ES2015 (e.g. node 0.10) treat __proto__ as special on every
// object, including the ones created with Object.create(null)
var nullProtoIsDictionary = (function () {
  var obj = Object.create(null)
  obj[PROTO_KEY] = { polluted: true }
  return obj.polluted === undefined
})()

tape('field option path does not pollute Object.prototype', function (t) {
  try {
    schema.parse('syntax = "proto3";\nmessage Exploit {\n  string a = 1 [(__proto__).polluted = "HACKED"];\n}')
  } catch (err) {
    // rejecting the option path is fine too
  }
  t.equal(({}).polluted, undefined, 'Object.prototype is not polluted')
  t.end()
})

tape('enum option named __proto__ does not change the options prototype', function (t) {
  var sch = schema.parse('enum Foo {\n  option __proto__ = {\n    polluted: true;\n  };\n  BAR = 1;\n}')
  var options = sch.enums[0].options
  t.equal(({}).polluted, undefined, 'Object.prototype is not polluted')
  if (nullProtoIsDictionary) {
    t.equal(Object.getPrototypeOf(options), null, 'options prototype is untouched')
    t.equal(options.polluted, undefined, 'options do not inherit the parsed value')
    t.same(Object.keys(options), [PROTO_KEY], 'option is kept as a plain key')
  }
  t.end()
})

tape('options named __proto__ are kept as plain keys', function (t) {
  var proto = [
    'option (__proto__) = { polluted: true; };',
    'option (my_option) = { __proto__: { polluted: true; }; };',
    'enum Foo {',
    '  BAR = 1 [(__proto__) = "HACKED"];',
    '}',
    'message Baz {',
    '  option (__proto__) = { polluted: true; };',
    '  optional string a = 1 [(__proto__) = "HACKED"];',
    '}',
    'service Qux {',
    '  option (__proto__) = { polluted: true; };',
    '  rpc Quux(Baz) returns (Baz) {',
    '    option (__proto__) = { polluted: true; };',
    '  }',
    '}'
  ].join('\n')

  var sch = null
  try {
    sch = schema.parse(proto)
  } catch (err) {
    t.notOk(nullProtoIsDictionary, 'parse only fails where __proto__ is special on every object')
  }
  t.equal(({}).polluted, undefined, 'Object.prototype is not polluted')

  if (nullProtoIsDictionary && sch) {
    var holders = [
      sch.options,
      sch.options.my_option,
      sch.enums[0].values.BAR.options,
      sch.messages[0].options,
      sch.messages[0].fields[0].options,
      sch.services[0].options,
      sch.services[0].methods[0].options
    ]
    holders.forEach(function (holder) {
      t.equal(Object.getPrototypeOf(holder), null, 'prototype is untouched')
      t.ok(Object.prototype.hasOwnProperty.call(holder, PROTO_KEY), '__proto__ is an own key')
      t.equal(holder.polluted, undefined, 'parsed value is not inherited')
    })
    t.same(sch.options.my_option[PROTO_KEY], { polluted: true }, 'option map value is preserved')
    t.equal(sch.messages[0].fields[0].options[PROTO_KEY], '"HACKED"', 'field option value is preserved')
  }
  t.end()
})
