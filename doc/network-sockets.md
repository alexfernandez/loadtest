# Network Sockets

To improve performance the author tried out using raw network sockets
using the [net module](https://nodejs.org/api/net.html),
instead of the [HTTP module](https://nodejs.org/api/http.html).
This is the story of how it went.

## Rationale

Keep-alive (option `-k`) makes a huge difference in performance:
instead of opening a new socket for every request,
the same connection is reused,
so it is usually much faster.

We need to run the measurements with and without it
to see how each factor is affected.

## Implementations

All measurements against the test server using 3 cores (default):

```
node bin/testserver.js
```

Running on an Intel Core i5-12400T processor with 6 cores.

### Targets

We compare a few packages on the test machine.
Keep in mind that `autocannon` does not use keep-alive while `ab` does,
so they are not to be compared between them.

#### Apache ab

First target performance is against [Apache `ab`](https://httpd.apache.org/docs/2.4/programs/ab.html),
with 10 concurrent connections without keep-alive.

```
ab -t 10 -c 10 http://localhost:7357/
[...]
Requests per second:    20395.83 [#/sec] (mean)
```

Results are around 20 krps.
Keep-alive cannot be used as far as the author knows.

#### Autocannon

The [autocannon](https://www.npmjs.com/package/autocannon) package uses by default
10 concurrent connections with keep-alive enabled:

```
autocannon http://localhost:7357/
[...]
┌───────────┬─────────┬─────────┬─────────┬─────────┬──────────┬─────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg      │ Stdev   │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼──────────┼─────────┼─────────┤
│ Req/Sec   │ 51295   │ 51295   │ 57343   │ 59103   │ 56798.55 │ 2226.35 │ 51285   │
├───────────┼─────────┼─────────┼─────────┼─────────┼──────────┼─────────┼─────────┤
│ Bytes/Sec │ 6.36 MB │ 6.36 MB │ 7.11 MB │ 7.33 MB │ 7.04 MB  │ 276 kB  │ 6.36 MB │
└───────────┴─────────┴─────────┴─────────┴─────────┴──────────┴─────────┴─────────┘
```

Results are around 57 krps.
Keep-alive cannot be disabled as far as the author knows.

### Baseline

The baseline is the existing `http` implementation in `loadtest` 7.1,
running on one core.

Without keep-alive close to 6 krps:

```
node bin/loadtest.js http://localhost:7357 --cores 1
[...]
Effective rps:       6342
```

Very far away from the 20 krps given by `ab`.
With keep-alive:

```
node bin/loadtest.js http://localhost:7357 --cores 1 -k
[...]
Effective rps:       20490
```

Again quite far from the 57 krps by `autocannon`.

### Proof of Concept

For the first implementation we want to learn if the bare sockets implementation is worth the time.
In this naïve implementation we open the socket,
send a short canned request without taking into account any parameters or headers:

```
this.params.request = `${this.params.method} ${this.params.path} HTTP/1.1\r\n\r\n`
```

We don't parse the result either,
just assume that it is received as one packet
and disregard it.
The results are almost 80 krps:

```
node bin/loadtest.js http://localhost:7357 --cores 1 --net
[...]
Effective rps:       79997
```

Very promising start!
Obviously this only works properly with GET requests without any body,
so it is only useful as a benchmark:
we want to make sure we don't lose too much performance when adding all the functionality.

We can also do a barebones implementation without keep-alive,
creating a new socket for every request.
The result is around 10 krps,
still far from Apache `ab`.
But here there is not much we can do:
apparently writing sockets in C is more efficient than in Node.js,
or perhaps `ab` has some tricks up its sleeve,
probably some low level optimizations.
In the Node.js code there is not much fat we can trim.

So from now on we will focus on the keep-alive tests.

### Adding Headers

First we add the proper headers in the request.
This means we are sending out more data for each round,
but performance doesn't seem to be altered much,
still around 80 krps.

The request we are now sending is:

```
GET / HTTP/1.1
host: localhost:7357
accept: */*
user-agent: loadtest/7.1.0
Connection: keep-alive

```

One interesting bit is that sending the header `connection: keep-alive`
does not affect performance;
however, sending `connection: close` breaks performance to 8 requests per second.
Probably there are huge inefficiencies in the way sockets are created.
This should be investigated in depth at some point,
if we want to have a test without keep-alive at some point.

### Parsing Responses

Now we come to the really critical part:
parsing the response including the content.

A very simple implementation just parses the response as a string,
reads the first line and extracts the status code.
Performance is now down to around 68 krps.
Note that we are still assuming that each response is a single packet.

To move ahead we need to parse all incoming headers,
find the content length,
and then parse the rest of the packet.
Again, a very simple implementation that parses content length and checks against body length
goes down to 63 krps.

It is possible that a response comes in multiple packets,
so we need to keep some state between packets.
This is the next step.
Keep in mind that even headers can be so long that they come in several packets!
With decent packet parsing,
including multi-packet bodies,
performance goes down to 60 krps.

