# TCP Sockets

To improve performance the author tried out using raw TCP sockets
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
Performance numbers are shown in bold and as thousands of requests per second (krps):
**80 krps**.

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

Results are around **20 krps**.
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

Results are around **57 krps**.
Keep-alive cannot be disabled as far as the author knows.

### Baseline

The baseline is the existing `http` implementation in `loadtest` 7.1,
running on one core.

Without keep-alive close to **6 krps**:

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

We are around **20 krps**.
Again quite far from the 57 krps by `autocannon`;
close to `ab` but it doesn't use keep-alive so the comparison is meaningless.

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
The results are almost **80 krps**:

```
node bin/loadtest.js http://localhost:7357 --cores 1 --tcp
[...]
Effective rps:       79997
```

Very promising start!
Obviously this only works properly with GET requests without any body,
so it is only useful as a benchmark:
we want to make sure we don't lose too much performance when adding all the functionality.

We can also do a barebones implementation without keep-alive,
creating a new socket for every request.
The result is around **10 krps**,
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
still around **80 krps**.

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
Performance is now down to around **68 krps**.
Note that we are still assuming that each response is a single packet.
A sample response from the test server included with `loadtest`
can look like this:

```
HTTP/1.1 200 OK
Date: Fri, 08 Sep 2023 11:04:21 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 2

OK
```

We can see a very simple HTTP response that fits in one packet.

### Parsing All Headers

It is possible that a response comes in multiple packets,
so we need to keep some state between packets.
This is the next step:
we should make sure that we have received the whole body and not just part of it.
The way to do this is to read the `content-length` header,
and then check that the body that we have has this length;
only then can we be 100% sure that we have the whole body.

Therefore we need to parse all incoming headers,
find the content length (in the header `content-length`),
and then parse the rest of the packet to check that we have the whole body.
Again, a very simple implementation that parses content length and checks against body length
goes down to **63 krps**.

If the body is not complete we need to keep the partial body,
and add the rest as it comes until the required `content-length`.
Keep in mind that even headers can be so long that they come in several packets!
In this case even more state needs to be stored between packets.

With decent packet parsing,
including multi-packet headers and bodies,
performance goes down to **60 krps**.
Most of the time is spent parsing headers,
since the body only needs to be checked for length,
not parsed.

### Considering Duplicates

Given that answers tend to be identical in a load test,
perhaps changing a date or a serial number,
we can apply a trick:
when receiving a packet check if it's similar enough to one received before
so we can skip parsing the headers altogether.

The algorithm checks the following conditions:

- Length of the received packet is less than 1000 bytes.
- Length of the packet is identical to one received before.
- Length of headers and body are also identical.
- Same status as before.

If all of them apply then the headers in the message are not parsed:
we estimate that the packet is complete and we don't need to check for content length.
Keep in mind that we _might_ be wrong:
we might have received a packet with just part of a response
that happens to have the same length, status and header length as a previous complete response,
and which is also below 1000 bytes.
This is however extremely unlikely.

Using this trick we go back to **67 krps**.

Packets of different lengths are stored for comparison,
which can cause memory issues when size varies constantly.

### Multiprocess

Now we can go back to using multiple cores:

```
node bin/loadtest.js http://localhost:7357 --cores 3 --tcp
[...]
Effective rps:       115379
```

In this case half the available cores,
leaving the rest for the test server.
Now we go up to **115 krps**!

For comparison we try using `autocannon` also with three workers:

```
autocannon http://localhost:7357/ -w 3 -c 30
[...]
┌───────────┬───────┬───────┬─────────┬─────────┬──────────┬─────────┬───────┐
│ Stat      │ 1%    │ 2.5%  │ 50%     │ 97.5%   │ Avg      │ Stdev   │ Min   │
├───────────┼───────┼───────┼─────────┼─────────┼──────────┼─────────┼───────┤
│ Req/Sec   │ 88511 │ 88511 │ 107071  │ 110079  │ 105132.8 │ 6148.39 │ 88460 │
├───────────┼───────┼───────┼─────────┼─────────┼──────────┼─────────┼───────┤
│ Bytes/Sec │ 11 MB │ 11 MB │ 13.3 MB │ 13.6 MB │ 13 MB    │ 764 kB  │ 11 MB │
└───────────┴───────┴───────┴─────────┴─────────┴──────────┴─────────┴───────┘
```

Median rate (50% percentile) is **107 krps**.
So `loadtest` has managed to be slightly above `autocannon`,
using multiple tricks.

### Pool of Clients

We are not done yet.
As it happens the new code is not very precise with connections and clients:
in particular it doesn't play nice with our `--rps` feature,
which is used to send an exact number of requests per second.
We need to do a complete refactoring to have a pool of clients,
take them to fulfill a request and them free them back to the pool.

After the refactoring we get some bad news:
performance has dropped down back to **60 krps**!

```
node bin/loadtest.js http://localhost:7357/ --tcp --cores 1
[...]
Effective rps:       60331
```

We need to do the painstaking exercise of getting back to our target performance.


