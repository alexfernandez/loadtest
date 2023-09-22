# Load Testing with TCP Sockets

The `loadtest` module has impressive performance,
and it has got better during the years as the Node.js core improves.
Heavily inspired by `autocannon`,
the author has tried out using raw TCP sockets to improve performance.
They use the [net module](https://nodejs.org/api/net.html)
instead of the [HTTP module](https://nodejs.org/api/http.html).
This is the story of how it went.
Spoiler: just add `--tcp` to your command line for a speed boost!

## Rationale

The keep-alive (option `-k`) makes a huge difference in performance:
instead of opening a new socket for every request,
the same connection is reused,
so it is usually much faster.

We need to run the measurements with and without it
to see how each factor is affected.

### Summary

The following tables summarize all comparisons.
Fastest option is shown **in bold**.
Results are shown with one core (or worker, or thread) and three cores for the load tester.
Detailed explanations follow.

First without keep-alive, one-core load tester against 3-core test server:

|package|krps|
|-------|----|
|loadtest|6|
|tcp barebones|10|
|loadtest tcp|9|
|ab|**20**|
|autocannon|8|

Now with keep-alive, also one-core load tester against 3-core test server:

|package|krps|
|-------|----|
|loadtest|21|
|tcp barebones|**80**|
|loadtest tcp|68|
|autocannon|57|
|wrk|73|

With keep-alive, 3-core load tester against 3-core test server:

|package|krps|
|-------|----|
|loadtest|54|
|loadtest tcp|115|
|autocannon|107|
|wrk|**118**|

With keep-alive, 1-core load tester against Nginx:

|package|krps|
|-------|----|
|loadtest|19|
|loadtest tcp|61|
|autocannon|40|
|wrk|**111**|

Finally with keep-alive, 3-core load tester against Nginx:

|package|krps|
|-------|----|
|loadtest|49|
|loadtest tcp|111|
|autocannon|80|
|wrk|**122**|

## Implementations

All measurements against the test server using 3 cores
(the default configuration for our six-core machine),
unless specified otherwise:

```console
$ node bin/testserver.js
```

Note that the first `$` is the console prompt.
Tests run on an Intel Core i5-12400T processor with 6 cores,
with Ubuntu 22.04.3 LTS (Xubuntu actually).
Performance numbers are shown in bold and as thousands of requests per second (krps):
**80 krps**.

### Targets

We compare a few packages on the test machine.
Keep in mind that `ab` does not use keep-alive while `autocannon` does,
so they are not to be compared between them.

#### Apache ab

First target performance is against [Apache `ab`](https://httpd.apache.org/docs/2.4/programs/ab.html).

```console
$ ab -V
Version 2.3 <$Revision: 1879490 $>
```

With 10 concurrent connections without keep-alive.

```console
$ ab -t 10 -c 10 http://localhost:7357/
[...]
Requests per second:    20395.83 [#/sec] (mean)
```

Results are around **20 krps**.
Keep-alive cannot be used with `ab` as far as the author knows.

#### Autocannon

Next we will try out [`autocannon`](https://www.npmjs.com/package/autocannon),
the package that actually inspired this approach.
`autocannon` uses by default 10 concurrent connections with keep-alive enabled:

```console
$ autocannon --version
autocannon v7.12.0
node v18.17.1
```

```console
$ autocannon http://localhost:7357/
[...]
┌───────────┬─────────┬─────────┬─────────┬─────────┬──────────┬─────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg      │ Stdev   │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼──────────┼─────────┼─────────┤
│ Req/Sec   │ 51295   │ 51295   │ 57343   │ 59103   │ 56798.55 │ 2226.35 │ 51285   │
├───────────┼─────────┼─────────┼─────────┼─────────┼──────────┼─────────┼─────────┤
│ Bytes/Sec │ 6.36 MB │ 6.36 MB │ 7.11 MB │ 7.33 MB │ 7.04 MB  │ 276 kB  │ 6.36 MB │
└───────────┴─────────┴─────────┴─────────┴─────────┴──────────┴─────────┴─────────┘
```

We will look at the median rate (reported as 50%),
so results are around **57 krps**.
Keep-alive cannot be disabled with an option,
but it can be changed directly in the code by setting the header `Connection: close`.
Performance is near **8 krps**:

```console
$ npx autocannon http://localhost:7357/
[...]
┌───────────┬────────┬────────┬────────┬────────┬────────┬─────────┬────────┐
│ Stat      │ 1%     │ 2.5%   │ 50%    │ 97.5%  │ Avg    │ Stdev   │ Min    │
├───────────┼────────┼────────┼────────┼────────┼────────┼─────────┼────────┤
│ Req/Sec   │ 5831   │ 5831   │ 7703   │ 8735   │ 7674.4 │ 753.53  │ 5828   │
├───────────┼────────┼────────┼────────┼────────┼────────┼─────────┼────────┤
│ Bytes/Sec │ 560 kB │ 560 kB │ 739 kB │ 839 kB │ 737 kB │ 72.4 kB │ 559 kB │
└───────────┴────────┴────────┴────────┴────────┴────────┴─────────┴────────┘
```

#### `wrk`

To complete the set we try `wrk`:

```console
$ wrk -v
wrk debian/4.1.0-3build1 [epoll]
```

With a single thread (core) for fair comparison we get almost **73 krps**:

```console
$ wrk http://localhost:7357/ -t 1
[...]
Requests/sec:  72639.52
```

### Baseline

The baseline is the existing `http` implementation in `loadtest` 7.1.1,
running on one core.

Without keep-alive close to **6 krps**:

```console
$ node bin/loadtest.js http://localhost:7357 --cores 1
[...]
Effective rps:       6342
```

Very far away from the 20 krps given by `ab`.
With keep-alive:

```console
$ node bin/loadtest.js http://localhost:7357 --cores 1 -k
[...]
Effective rps:       20490
```

We are around **20 krps**.
Again quite far from the 57 krps by `autocannon`;
close to `ab` but it doesn't use keep-alive so the comparison is meaningless.

### Proof of Concept: Barebones

For the first implementation we want to learn if the bare sockets implementation is worth the time.
In this naïve barebones implementation we open the socket,
send a short canned request without taking into account any parameters or headers:

```js
this.params.request = `${this.params.method} ${this.params.path} HTTP/1.1\r\n\r\n`
```

We don't parse the result either,
just assume that it is received as one packet
and disregard it.
The results are almost **80 krps**:

```console
$ node bin/loadtest.js http://localhost:7357 --cores 1 --tcp
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

### Multiprocess, Multi-core

Now we can go back to using multiple cores:

```console
$ node bin/loadtest.js http://localhost:7357 --cores 3 --tcp
[...]
Effective rps:       115379
```

In this case half the available cores,
leaving the rest for the test server.
Now we go up to **115 krps**!

What about regular `http` connections without the `--tcp` option?
It stays at **54 krps**:

```console
$ node bin/loadtest.js http://localhost:7357/ -k --cores 3
[...]
Effective rps:       54432
```

For comparison we try using `autocannon` also with three workers:

```console
$ autocannon http://localhost:7357/ -w 3 -c 30
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
Now `wrk` which yields **118 krps**:

```console
$ wrk http://localhost:7357/ -t 3
[...]
Requests/sec:  118164.03
```

So `loadtest` has managed to be slightly above `autocannon` using multiple tricks,
but below `wrk`.

### Pool of Clients

We are not done yet.
As it happens the new code is not very precise with connections and clients:
in particular it doesn't play nice with our `--rps` feature,
which is used to send an exact number of requests per second.
We need to do a complete refactoring to have a pool of clients,
take them to fulfill a request and them free them back to the pool.

After the refactoring we get some bad news:
performance has dropped down back to **60 krps**!

```console
$ node bin/loadtest.js http://localhost:7357/ --tcp --cores 1
[...]
Effective rps:       60331
```

We need to do the painstaking exercise of getting back to our target performance.

### Profiling and Micro-profiling

We need to see where our microseconds (µs) are being spent.
Every microsecond counts: between 67 krps (15 µs per request) to 60 krps (16.7 µs per request)
the difference is... less than two microseconds.

We use the [`microprofiler`](https://github.com/alexfernandez/microprofiler) package,
which allows us to instrument the code that is sending and receiving requests.
For instance the function `makeRequest()` in `lib/tcpClient.js` which is sending out the request:

```js
import microprofiler from 'microprofiler'

[...]
    makeRequest() {
        if (!this.running) {
            return
        }
        // first block: connect
        const start1 = microprofiler.start()
        this.connect()
        microprofiler.measureFrom(start1, 'connect', 100000)
        // second block: create parser
        const start2 = microprofiler.start()
        this.parser = new Parser(this.params.method)
        microprofiler.measureFrom(start2, 'create parser', 100000)
        // third block: start measuring latency
        const start3 = microprofiler.start()
        const id = this.latency.begin();
        this.currentId = id
        microprofiler.measureFrom(start3, 'latency begin', 100000)
        // fourth block: write to socket
        const start4 = microprofiler.start()
        this.connection.write(this.params.request)
        microprofiler.measureFrom(start4, 'write', 100000)
    }
```

Each of the four calls are instrumented.
When this code runs the output has a lot of lines like this:

```console
$ node bin/loadtest.js http://localhost:7357/ --tcp --cores 1
[...]
Profiling connect: 100000 requests, mean time: 1.144 µs, rps: 6948026
Profiling create parser: 100000 requests, mean time: 0.152 µs, rps: 6582446
Profiling latency begin: 100000 requests, mean time: 1.138 µs, rps: 878664
Profiling write: 100000 requests, mean time: 5.669 µs, rps: 176409
```

Note that the results oscillate something like 0.3 µs from time to time,
so don't pay attention to very small differences.
Mean time is the interesting part: from 0.152 to create the parser µs to 5.669 µs for the write.
There is not a lot that we can do with the `connection.write()` call,
since it's directly speaking with the Node.js core;
we can try reducing the message size (not sending all headers)
but it doesn't seem to do much.
So we center on the `this.connect()` call,
which we can reduce to less than a µs.
Then we repeat again on the `finishRequest()` call to see if we can squeeze another microsecond there.

After some optimizing and a lot of bug fixing we are back to **68 krps**:

```console
$ node bin/loadtest.js http://localhost:7357/ --tcp --cores 1
[...]
Effective rps:       68466
```

With classic `loadtest` without the `--tcp` option, we still get **21 krps**:

```console
$ node bin/loadtest.js http://localhost:7357/ -k --cores 1
[...]
Effective rps:       21446
```

Marginally better than before.
By the way, it would be a good idea to try again without keep-alive.
There is currently no option to disable keep-alive,
but it can be done by hacking the header as
`Keep-alive: close`.
We get a bit less performance than the barebones implementation,
almost **9 krps**:

```console
$ node bin/loadtest.js http://localhost:7357/ --tcp --cores 1
[...]
Effective rps:       8682
```

### Reproducible Script

The current setup is a bit cumbersome: start the server,
then start the load test with the right parameters.
We need to have a reproducible way of getting performance measurements.
So we introduce the script `bin/tcp-performance.js`,
that starts a test server and then runs a load test with the parameters we have been using.
Unfortunately the test server only uses one core (being run in API mode),
and maxes out quickly at **27 krps**.

```console
$ node bin/tcp-performance.js 
[...]
Effective rps:       27350
```

The author has carried out multiple attempts at getting a multi-core test server running:
use the cluster module,
run as a multi-core process,
run it as a script using
[child_process.exec()](https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback)...
They all add too much complexity.
So we can use the single-core measurements as a benchmark,
even if they are not representative of full operation.

By the way, `autocannon` does a bit better in this scenario (single-core test server),
as it reaches **43 krps**.
How does it do this magic?
One part of the puzzle can be that it sends less headers,
without `user-agent` or `accepts`.
So we can do a quick trial of removing these headers in `loadtest`:

```console
$ node bin/loadtest.js http://localhost:7357/ --tcp --cores 1
[...]
Effective rps:       29694
```

Performance is improved a bit but not much, to almost **30 krps**.
How `autocannon` does this wizardry is not evident.

### Face-off with Nginx

Our last test is to run `loadtest` against a local Nginx server,
which is sure not to max out with only one core:
it goes to **61 krps**.

```console
$ node bin/loadtest.js http://localhost:80/ --tcp --cores 1
[...]
Effective rps:       61059
```

While without `--tcp` we only get **19 krps**.
A similar test with `autocannon` yields only **40 krps**:

```console
$ autocannon http://localhost:80/
[...]
┌───────────┬─────────┬─────────┬───────┬─────────┬─────────┬─────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%   │ 97.5%   │ Avg     │ Stdev   │ Min     │
├───────────┼─────────┼─────────┼───────┼─────────┼─────────┼─────────┼─────────┤
│ Req/Sec   │ 34591   │ 34591   │ 40735 │ 43679   │ 40400   │ 2664.56 │ 34590   │
├───────────┼─────────┼─────────┼───────┼─────────┼─────────┼─────────┼─────────┤
│ Bytes/Sec │ 29.7 MB │ 29.7 MB │ 35 MB │ 37.5 MB │ 34.7 MB │ 2.29 MB │ 29.7 MB │
└───────────┴─────────┴─────────┴───────┴─────────┴─────────┴─────────┴─────────┘
```

Now it's not evident either how it reaches less performance against an Nginx
than against our Node.js test server,
but the numbers are quite consistent.
While `wrk` takes the crown again with **111 krps**:

```console
$ wrk http://localhost:80/ -t 1
[...]
Requests/sec: 111176.14
```

Running again `loadtest` with three cores we get **111 krps**:

```console
$ node bin/loadtest.js http://localhost:80/ --tcp --cores 3
[...]
Effective rps:       110858
```

Without `--tcp` we get **49 krps**.
While `autocannon` with three workers reaches **80 krps**:

```console
$ autocannon http://localhost:80/ -w 3
[...]
┌───────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg     │ Stdev   │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Req/Sec   │ 65727   │ 65727   │ 80191   │ 84223   │ 78668.8 │ 5071.38 │ 65676   │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Bytes/Sec │ 56.4 MB │ 56.4 MB │ 68.9 MB │ 72.4 MB │ 67.6 MB │ 4.36 MB │ 56.4 MB │
└───────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```

Consistent with the numbers reached above against a test server with 3 cores.

`wrk` does not go much further with three threads than with one, at **122 krps**:

```console
$ wrk http://localhost:80/ -t 3
[...]
Requests/sec: 121991.96
```

## Conclusions

It is good to know that `loadtest` can hold its own against such beasts like `ab`,
`autocannon` or `wrk`.
`ab` and `wrk` are written in C,
while `autocannon` is maintained by Matteo Collina who is one of the leading Node.js performance gurus.

There are some unexplained effects,
like why does `autocannon` perform so poorly against Nginx.
It would be really interesting to understand it.

Now with TCP sockets and keep-alive you can use `loadtest`
to go beyond the paltry 6 to 20 krps that we used to get:
especially with multiple cores you can reach 100 krps locally.
If you need performance that goes beyond that,
you can try some of the other options used here.

Note that there are many options not yet implemented for TCP sockets,
like secure connections with HTTPS.
They will come in the next releases.

