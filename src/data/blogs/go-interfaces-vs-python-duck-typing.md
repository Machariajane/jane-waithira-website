## Introduction

Coming from Python, Go's type system felt alien at first. But once you see how Go interfaces map to concepts you already know — duck typing, `self`, constructors — everything clicks. This post is a side-by-side comparison of the two languages, focused on interfaces, data storage, and method access.

---

## Table of Contents

1. [Go Interfaces vs Python Duck Typing](#go-interfaces-vs-python-duck-typing)
2. [Data Storage and Method Access: Python self vs Go Receivers](#data-storage-and-method-access-python-self-vs-go-receivers)
3. [Creating Instances: Python __init__ vs Go Struct Literals](#creating-instances-python-init-vs-go-struct-literals)
4. [The Receiver: Value vs Pointer](#the-receiver-value-vs-pointer)
5. [Constructors: Python __init__ vs Go Convention](#constructors-python-init-vs-go-convention)
6. [Memory, Pointers and References: Python vs Go](#memory-pointers-and-references-python-vs-go)
7. [Functions: Python vs Go](#functions-python-vs-go)
8. [Quick Reference](#quick-reference)

---

## Go Interfaces vs Python Duck Typing

**Python — Duck Typing:** "If it has a `.read()` method, just call it and hope for the best."
- No contract declared — the function signature `def get_data(source)` tells you nothing
- Errors caught at **runtime** (`AttributeError` when the method doesn't exist)
- Python's fix (ABC) only enforces on the **class**, not the **caller** — `get_data(BrokenSource())` still runs

**Go — Interfaces:** "If it has a `Read()` method, it satisfies `Reader` — and the compiler proves it."
- Contract is explicit — `func GetData(source Reader)` tells you exactly what's needed
- Errors caught at **compile time** (code won't build if the type doesn't fit)
- No `implements` keyword — satisfaction is implicit, just like duck typing
- Interfaces compose cleanly: `ReadCloser` = `Reader` + `Closer`

**The `type` keyword does two things in Go:**
- `type Database struct { ... }` — concrete thing with data (like a Python `class`)
- `type Reader interface { ... }` — contract with no data (like a Python `ABC`, but enforced on both sides)

---

## Data Storage and Method Access: Python self vs Go Receivers

### Python — self stores and accesses data

```python
class Database:
    def __init__(self, host, port):
        self.host = host          # store data
        self.port = port

    def connect(self):
        return f"Connecting to {self.host}:{self.port}"   # access data via self

    def close(self):
        self.host = None          # modify data via self
        return "Closed"

db = Database("localhost", 5432)
print(db.connect())   # "Connecting to localhost:5432"
print(db.host)        # "localhost" — access fields directly, no enforcement
db.host = 12345       # no error! you just put an int where a string should be
db.oops = "anything"  # no error! you just invented a new field at runtime
```

**Problems:**
- Anyone can read/modify any field
- Can add fields that don't exist
- Can put wrong types in fields
- All caught at runtime (or never)

---

### Go — struct stores data, receiver accesses it

```go
type Database struct {
    Host string    // types enforced at compile time
    Port int
}

// (d Database) is the receiver — Go's version of self
// This is a VALUE receiver — gets a COPY, can't modify original
func (d Database) Connect() string {
    return fmt.Sprintf("Connecting to %s:%d", d.Host, d.Port)
}

// (d *Database) is a POINTER receiver — can modify the original
func (d *Database) Close() string {
    d.Host = ""    // modifies the actual struct
    return "Closed"
}

db := Database{Host: "localhost", Port: 5432}
fmt.Println(db.Connect())  // "Connecting to localhost:5432"
fmt.Println(db.Host)       // "localhost"

db.Host = 12345            // COMPILE ERROR: cannot use int as string
db.Oops = "anything"       // COMPILE ERROR: db.Oops undefined (no such field)
```

---

## Creating Instances: Python __init__ vs Go Struct Literals

```python
# Python — data goes through __init__ -> stored on self
db = Database("localhost", 5432)
#              |            |
# def __init__(self, host, port):
#     self.host = host     <- "localhost"
#     self.port = port     <- 5432
```

```go
// Go — data goes directly into the struct (no constructor needed)
db := Database{Host: "localhost", Port: 5432}
//              |                  |
// type Database struct {
//     Host string     <- "localhost"
//     Port int        <- 5432
// }
```

Python **needs** `__init__` to wire up the data. Go **doesn't** — you fill struct fields directly by name.

---

## The Receiver: Value vs Pointer

This is something Python doesn't have — Go makes you choose:

```go
// VALUE receiver — gets a copy (like passing a photocopy)
func (d Database) Connect() string {
    d.Host = "modified"   // only modifies the copy!
    return d.Host
}

// POINTER receiver — gets the original (like passing the actual document)
func (d *Database) Reset() {
    d.Host = ""           // modifies the real struct
    d.Port = 0
}
```

```python
# Python — self is ALWAYS a reference (always pointer, no choice)
class Database:
    def connect(self):
        self.host = "modified"   # always modifies the original
```

| | Python `self` | Go value `(d Database)` | Go pointer `(d *Database)` |
|---|---|---|---|
| **Gets** | Reference (always) | Copy | Reference |
| **Can modify original?** | Always yes | No | Yes |
| **You choose?** | No choice | You choose | You choose |

---

## Constructors: Python __init__ vs Go Convention

### Python — Built-in Constructor (__init__)

`__init__` is a **magic method** — Python calls it automatically when you create an instance:

```python
class Database:
    def __init__(self, host, port=5432):   # runs automatically on Database(...)
        self.host = host
        self.port = port
        self.connected = False             # can set defaults
        if port < 0:
            raise ValueError("bad port")   # can validate

db = Database("localhost", 5432)   # __init__ called for you — you never call it directly
```

### Go — No Constructors. Just a Function.

Go has **zero magic**. There's no `__init__`, no special method. You either fill the struct directly:

```go
db := Database{Host: "localhost", Port: 5432}   // no constructor, just assign
```

Or you write a **regular function** called `NewXxx` (a convention, not a language feature):

```go
func NewDatabase(host string, port int) *Database {
    if port == 0 {
        port = 5432                          // set defaults
    }
    return &Database{Host: host, Port: port} // & = return a pointer to the struct
}

db := NewDatabase("localhost", 0)   // you call it yourself — nothing automatic
// db.Host = "localhost"
// db.Port = 5432 (defaulted)
```

The `&` and `*Database` syntax is about pointers — covered in detail in [Memory, Pointers and References](#memory-pointers-and-references-python-vs-go) below.

### Side-by-Side

| | Python | Go |
|---|---|---|
| **Constructor** | `__init__` (magic, automatic) | `NewXxx` function (convention, manual) |
| **Called when?** | Automatically on `Database(...)` | You call `NewDatabase(...)` yourself |
| **Can validate?** | Yes (raise exception) | Yes (return error) |
| **Can set defaults?** | Yes | Yes |
| **Special syntax?** | Yes (`def __init__(self, ...)`) | No — it's just a normal function |

---

## Memory, Pointers and References: Python vs Go

### First — What's Memory?

When you create a variable, it lives somewhere in your computer's RAM. That "somewhere" has an **address** — like a house address.

```
RAM (your computer's memory):
┌──────────┬──────────┬──────────┬──────────┐
│ addr 100 │ addr 200 │ addr 300 │ addr 400 │
│ "hello"  │  5432    │ Database │   ...    │
└──────────┴──────────┴──────────┴──────────┘
```

A **pointer** is just a variable that stores an address instead of data. It says "the thing you want is at address 300."

---

### Python — You Never Think About This

Python hides all of this from you. **Everything is a reference (pointer) by default**:

```python
db1 = Database("localhost", 5432)
db2 = db1       # db2 points to the SAME object — not a copy

db2.port = 9999
print(db1.port)  # 9999 — db1 changed too! both point to the same thing

# What's actually happening:
# db1 ──→ ┌──────────────────┐
#          │ host: "localhost" │
# db2 ──→ │ port: 9999        │  ← same object in memory
#          └──────────────────┘
```

You never see addresses, never write `&` or `*`. Python manages it all behind the scenes. Since both variables point to the same address, both have access to the same data in memory — so either one can modify it.

---

### Go — You Choose: Copy or Reference

Go makes you **explicitly decide**:

#### Option 1: Value (copy) — no `&`, no `*`

```go
db1 := Database{Host: "localhost", Port: 5432}
db2 := db1       // db2 gets a FULL COPY — separate object

db2.Port = 9999
fmt.Println(db1.Port)  // 5432 — db1 is unchanged! db2 is independent

// What's happening:
// db1 → ┌──────────────────┐
//        │ Host: "localhost" │
//        │ Port: 5432        │  ← original
//        └──────────────────┘
// db2 → ┌──────────────────┐
//        │ Host: "localhost" │
//        │ Port: 9999        │  ← separate copy
//        └──────────────────┘
```

#### Option 2: Pointer (reference) — use `&` and `*`

```go
db1 := &Database{Host: "localhost", Port: 5432}   // & = "give me the address"
db2 := db1       // db2 gets the SAME address — points to same object

db2.Port = 9999
fmt.Println(db1.Port)  // 9999 — db1 changed too! same as Python behavior

// What's happening (same as Python!):
// db1 ──→ ┌──────────────────┐
//          │ Host: "localhost" │
// db2 ──→ │ Port: 9999        │  ← same object
//          └──────────────────┘
```

---

### `&` vs `*` — They're Opposites, Not the Same Thing

| Symbol | What it does | Direction | Analogy |
|--------|-------------|-----------|---------|
| `&` | **Creates** a pointer — "give me the address of this thing" | data -> address | Writing down a house's address on a slip of paper |
| `*` | **Follows** a pointer — "go to this address and get the data" | address -> data | Reading the slip of paper and going to the house |

```go
db := Database{Host: "localhost", Port: 5432}   // the actual house

ptr := &db          // & = "what's the address of db?"  -> gives you a slip of paper
                    //     ptr now holds the address

fmt.Println(*ptr)   // * = "go to that address and get the data" -> goes to the house
                    //     prints {localhost 5432}

// They're inverses:
//   *(&db) == db      "go to the address of db" == db
```

In function signatures, `*` means "this parameter is an address, not the actual data":

```go
func Reset(db *Database) {    // *Database = "I receive an address"
    db.Port = 0               // Go automatically follows the pointer to the data
}

myDB := &Database{Port: 5432} // & = create the address
Reset(myDB)                   // pass the address
// myDB.Port is now 0 — Reset got the address, modified the original
```

---

### Why Use Pointers At All?

**1. Sharing changes** — if a function gets a copy, its changes are thrown away:

```go
func ResetCopy(db Database) {    // gets a COPY
    db.Port = 0                  // modifies the copy
}

func ResetReal(db *Database) {   // gets the ADDRESS
    db.Port = 0                  // modifies the original
}

db := Database{Port: 5432}
ResetCopy(db)
fmt.Println(db.Port)   // 5432 — nothing happened! changes were on a copy

ResetReal(&db)
fmt.Println(db.Port)   // 0 — this time it worked
```

**2. Performance** — copying a 100-field struct every function call is wasteful. An address is always 8 bytes.

**3. Shared access** — multiple functions need to work on the **same** object:

```go
db := &Database{Host: "localhost", Port: 5432}
Reset(db)      // give address to Reset
Backup(db)     // give address to Backup
Log(db)        // give address to Log
// all three work on the SAME database — like Python does by default
```

---

### The Three Symbols — Complete Picture

| Symbol | Name | Meaning | Example |
|--------|------|---------|---------|
| `Database` | Value type | "I am the actual data" | `db := Database{Port: 5432}` |
| `&Database{...}` | Address-of | "Give me the **address** of this data" | `db := &Database{Port: 5432}` |
| `*Database` | Pointer type | "I hold an **address** pointing to a Database" | `func f(db *Database)` |

Think of it like a house:
- `Database` = **the actual house** (you carry the whole house around)
- `&Database{...}` = **writing down the address** on a slip of paper
- `*Database` = **the slip of paper** with the address on it
- `*ptr` (dereferencing) = **reading the slip and going to the house**

---

### Why This Matters — Back to NewDatabase

```go
// Returns *Database (a pointer) — caller gets the address
func NewDatabase(host string, port int) *Database {
    return &Database{Host: host, Port: port}
    //     ^ "create a Database, then give me its address"
}

db := NewDatabase("localhost", 5432)
// db is a pointer (*Database) — like Python, you're working with the original
```

If it returned `Database` (not `*Database`):
```go
func NewDatabase(host string, port int) Database {
    return Database{Host: host, Port: port}
    // the ENTIRE struct gets copied to the caller
}
// For a small struct — fine. For a big struct — wasteful.
```

---

### When to Use Each

| Use value `Database` | Use pointer `*Database` |
|---|---|
| Small, simple data | Large structs |
| You **don't** want changes to propagate | You **want** changes to propagate |
| Read-only | Methods need to modify fields |
| Like passing a **photocopy** | Like passing **the original document** |

---

### Python vs Go Memory — Summary

```
Python                                 Go
------                                 --
db2 = db1                             db2 := db1          <- COPY (value)
# always a reference                  db2 := db1          <- SAME OBJECT (if db1 is *Database)

# you have NO CHOICE                  # you CHOOSE:
# everything is a reference           #   value    = copy (safe, independent)
#                                     #   pointer  = reference (shared, like Python)

# no symbols for this                 &  = "get the address"    (data -> address)
#                                     *  = "go to the address"  (address -> data)
#                                     They're OPPOSITES.
```

**One-liner:** Python always passes references and hides memory from you. Go lets you choose — value (copy) or pointer (reference) — and makes you say it explicitly with `&` (get the address) and `*` (follow the address).

---

## Functions: Python vs Go

### Python — def

```python
# Simple function
def add(a, b):
    return a + b

# Multiple return values (using tuple)
def divide(a, b):
    if b == 0:
        return 0, "cannot divide by zero"   # returns a tuple
    return a / b, None

result, err = divide(10, 0)

# Default arguments
def greet(name, greeting="Hello"):
    return f"{greeting}, {name}!"

greet("Jane")              # "Hello, Jane!"
greet("Jane", "Hey")       # "Hey, Jane!"
```

### Go — func

```go
// Simple function
func Add(a int, b int) int {
    return a + b
}

// Multiple return values (built into the language, not a tuple)
func Divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, fmt.Errorf("cannot divide by zero")
    }
    return a / b, nil
}

result, err := Divide(10, 0)

// NO default arguments in Go — you just pass everything explicitly
func Greet(name string, greeting string) string {
    return greeting + ", " + name + "!"
}

Greet("Jane", "Hello")     // must pass both — no defaults
```

### Key Differences

| | Python | Go |
|---|---|---|
| **Keyword** | `def` | `func` |
| **Types in signature?** | Optional (type hints) | Required |
| **Multiple returns** | Tuple trick `return a, b` | Built-in `(int, error)` |
| **Default arguments** | Yes `def f(x=5)` | No — pass everything |
| **Error handling** | `raise` / `try-except` | Return `error` as second value |
| **First-class?** | Yes (functions are objects) | Yes (functions are values) |

### Error Handling Pattern — This is Very Go

Python throws exceptions:
```python
try:
    result = divide(10, 0)
except ZeroDivisionError as e:
    print(f"Error: {e}")
```

Go returns errors explicitly — **every call site handles it**:
```go
result, err := Divide(10, 0)
if err != nil {
    fmt.Println("Error:", err)
    return
}
// safe to use result here
```

This is why Go code is full of `if err != nil` — it's not boilerplate, it's **explicit error handling at every step**. No hidden exceptions, no surprise crashes.

---

## Quick Reference

```
Python                                  Go
------                                  --
class Database:                         type Database struct {
    self.host = host                        Host string
    self.port = port                        Port int
                                        }

def connect(self):                      func (d Database) Connect() string {
    return self.host                        return d.Host
                                        }

def reset(self):                        func (d *Database) Reset() {
    self.host = ""                          d.Host = ""
                                        }

def __init__(self, host, port):         func NewDatabase(host string, port int) *Database {
    self.host = host                        return &Database{Host: host, Port: port}
    self.port = port                    }

db = Database("localhost", 5432)        db := Database{Host: "localhost", Port: 5432}
db.connect()                            db.Connect()
db.host = 123  <- no error              db.Host = 123  <- WON'T COMPILE
db.xyz = "hi"  <- no error              db.Xyz = "hi"  <- WON'T COMPILE

def add(a, b):                          func Add(a int, b int) int {
    return a + b                            return a + b
                                        }

result, err = divide(10, 0)             result, err := Divide(10, 0)
if err:                                 if err != nil {
    print(err)                              fmt.Println(err)
                                        }

def greet(name, greeting="Hello"):      // No defaults in Go — pass everything
    ...                                 func Greet(name, greeting string) string { ... }

db2 = db1  <- always a reference        db2 := db1   <- COPY (value type)
                                        db2 := db1   <- SAME OBJECT (pointer type)
# no symbols                            &  = "get address"   *  = "follow address"
```

**One-liner:** Go is duck typing with a compiler safety net. Python's `self` is always a reference with no guardrails. Go gives you a choice (value vs pointer receiver) and the compiler enforces types, field existence, and mutability.

