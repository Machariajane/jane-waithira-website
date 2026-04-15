## Introduction

Coming from Python, Go's type system felt alien at first. But once you see how Go interfaces map to concepts you already know — duck typing, `self`, constructors — everything clicks. This post is a side-by-side comparison of the two languages, focused on interfaces, data storage, and method access.

---

## Table of Contents

1. [Go Interfaces vs Python Duck Typing](#go-interfaces-vs-python-duck-typing)
2. [Data Storage and Method Access: Python self vs Go Receivers](#data-storage-and-method-access-python-self-vs-go-receivers)
3. [Creating Instances: Python __init__ vs Go Struct Literals](#creating-instances-python-init-vs-go-struct-literals)
4. [The Receiver: Value vs Pointer](#the-receiver-value-vs-pointer)
5. [Constructors: Python __init__ vs Go Convention](#constructors-python-init-vs-go-convention)
6. [Functions: Python vs Go](#functions-python-vs-go)
7. [Quick Reference](#quick-reference)

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

**What's `&Database{...}` and `*Database`?**
- `&` means "give me the **memory address** of this struct" (create a pointer)
- `*Database` means "this is a **pointer to** a Database"
- Why? So the caller gets the **original**, not a copy — same idea as Python's `self` always being a reference

```go
// Without pointer — caller gets a COPY (changes don't affect original)
func NewDatabase() Database { return Database{Port: 5432} }

// With pointer — caller gets the ORIGINAL (this is the convention)
func NewDatabase() *Database { return &Database{Port: 5432} }
```

### Side-by-Side

| | Python | Go |
|---|---|---|
| **Constructor** | `__init__` (magic, automatic) | `NewXxx` function (convention, manual) |
| **Called when?** | Automatically on `Database(...)` | You call `NewDatabase(...)` yourself |
| **Can validate?** | Yes (raise exception) | Yes (return error) |
| **Can set defaults?** | Yes | Yes |
| **Special syntax?** | Yes (`def __init__(self, ...)`) | No — it's just a normal function |

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
```

**One-liner:** Go is duck typing with a compiler safety net. Python's `self` is always a reference with no guardrails. Go gives you a choice (value vs pointer receiver) and the compiler enforces types, field existence, and mutability.

