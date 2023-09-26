# Cloud Performance

Performance on the cloud can be disappointing.
Be sure to benchmark and compare your cloud instances.

![Results. Source: the author.](cloud-performance.png "Results tabulated by price and performance. For bare iron, price is estimated for a typical laptop with three years of useful life. Bare iron in blue, AWS in red, GCP and Linode in yellow.")

## Installation

Ubuntu 22.04 LTS:

```shell
$ lsb_release -a
No LSB modules are available.
Distributor ID:	Ubuntu
Description:	Ubuntu 22.04.3 LTS
Release:	22.04
Codename:	jammy
```

Instructions on [nodesource](https://github.com/nodesource/distributions).

```
sudo apt install nodejs
```

Download repo and run benchmark:

```shell
$ git clone https://github.com/alexfernandez/loadtest
$ cd loadtest
$ npm install
$ node bin/tcp-performance.js
```

## Benchmarks

We will see a synthetic benchmark using bare iron,
and on some cloud providers.
The benchmark [`bin/tcp-performance.js`](https://github.com/alexfernandez/loadtest/blob/main/bin/tcp-performance.js)
starts the server on half the cores (max three), and then runs the loadtest on just one core,
to ensure that the servers can take the load.
It is (as its name implies) using bare sockets, as in the `--tcp` mode.

Result is best of three (if available), rounded to the nearest krps.
All results tabulated on
[Google Sheets](https://docs.google.com/spreadsheets/d/1_33mTCCVnKdBZf6ZZaDCbmd2ZcVzpwgIdS0RV3Nh1e8/edit?usp=sharing)
by price and performance,
estimating a typical laptop with three years of useful life.

### Bare Iron

I asked on Mastodon, Twitter and Meetup for contributions using different processors (CPUs).

First my own cirrus7, with an Intel Core CPU: i5-12400T. Result: **69 krps**.

```
Effective rps:       68391
Effective rps:       69082
Effective rps:       68044
```

Next a laptop with a CPU: Intel Core i7-9750H (courtesy of Javier Sánchez Criado).
Result: **42 krps**, tied for the weakest of the bunch.

```
Effective rps:       31878
[...]
Effective rps:       42439
```

Note: after the first test (32 krps) I realized that my benchmark had started the server on 6 cores,
when the processor actually has just 6 cores -- they turn to 12 using hyperthreading.
Therefore all 6 cores were busy with the server, and the `loadtest` process had to 
So I tuned the test server to start 3 cores max and Javier was nice enough to re-run it,
helping the result reach 42 krps.

My own laptop Tuxedo InfinityBook S 14 v5, with an Intel Core i5-10210U CPU @ 1.60GHz.
Result: **42 krps**, weakest of the bunch.

```
Effective rps:       41561
Effective rps:       41797
Effective rps:       42207
```

Now my new laptop frame.work 13" with an Intel Core i5-1340P.
Result: **173 krps**, absolute record.

```
Effective rps:       172586
Effective rps:       171574
Effective rps:       173009
```

MSI Modern 15 with CPU: AMD Ryzen 7 (courtesy of Juan David Guerrero).
Result: **46 krps**.

```
Effective rps:       45940
```

Finally a Dell laptop using a CPU: Intel Core i9-12900HK (courtesy of Manu Fosela).
Result: **162 krps**, previous record of the 12th generation.

```
Effective rps:       162517
```

Now we turn to the Apple side with a MacBook Pro 2021, sporting an Apple CPU: M1 Pro (courtesy of Eduardo Reyes).
Result: **74 krps**.

```
Effective rps:       64271
Effective rps:       73554
Effective rps:       73486
```

Note: execution improved over several iterations.

Another Mac, CPU: Apple M1 Max (courtesy of @slowdownitsfine@techhub.social). Result: **77 krps**.

```
Effective rps:       77497
```

Mac with CPU: Apple M1 Pro (courtesy of Steve Ridout). Result: **84 krps**.

```
Effective rps:       84219
```

MacBook Pro 14-inch, 2021, CPU: Apple M1 Pro (courtesy of Iván Coleto).
Result: **65 krps**.

```
Effective rps:       65464
```

A Macbook Air 2023, CPU: Apple M2 (courtesy of Juan Searle).
Result: **110 krps**, best of the Apple bunch.

```
Effective rps:       109672
```

MacBookPro15,1, CPU: 8-Core Intel Core i9 (courtesy of Juan Carlos Pérez Pardo).
Result: **38 krps**.

```
Effective rps:       38118
```

MacBook Pro Mac14,9, CPU: Apple M2 Pro (courtesy of Juan Carlos Pérez Pardo).
Result: **68 krps**. Weird, should be faster than M2 but isn't; runs zscaler.

```
Effective rps:       67735
```

MacBookPro12,1 2015, CPU: Intel Core i5 (2 cores) (courtesy of Paco Calvo).
Result: **11 krps**. Slowest of the series.

```
Effective rps:       9754
Effective rps:       10002
Effective rps:       10792
```

### AWS

Again Ubuntu 22.04 LTS.
Using 4 or even better 8 CPUs (i.e. cores) whenever possible
so the test server runs on several,
but remember that performance for `loadtest` is single-core.

Shared tenancy, `c5-xlarge` (4 CPUs) $138/mo.
CPU: Intel(R) Xeon(R) Platinum 8275CL CPU @ 3.00GHz.
Result: **45 krps**.

```
$ node bin/tcp-performance.js
Effective rps:       40597
Effective rps:       43169
Effective rps:       44708
```

Shared tenancy, `c5d-2xlarge` (8 CPUs) $276/mo.
CPU: Intel(R) Xeon(R) Platinum 8275CL CPU @ 3.00GHz.
Result: **66 krps**.

```
Effective rps:       66297
Effective rps:       66282
Effective rps:       65697
```

`c7i.xlarge` (4 CPUs): $145/mo.
CPU: Intel(R) Xeon(R) Platinum 8488C.
Result: **93 krps**.

```
Effective rps:       87724
Effective rps:       92516
Effective rps:       91890
```

`c7i.2xlarge` (8 CPUs): $290/mo.
CPU: Intel(R) Xeon(R) Platinum 8488C.
Result: **117 krps**, best of all clouds.

```
Effective rps:       113440
Effective rps:       110351
Effective rps:       116512
```

`c6g.xlarge` (4 CPUs) $105/mo. This one is interesting because it uses the arm64 architecture, advertised as "best cost-effectiveness".
CPU: ARM Neoverse-N1.
Result: **27 krps**, very disappointing.

```
Effective rps:       26747
Effective rps:       27430
Effective rps:       26680
```

`c6g.2xlarge` (4 CPUs) $210/mo, again using the arm64 architecture.
CPU: ARM Neoverse-N1.
Result: **28 krps**, again very disappointing.

```
Effective rps:       27557
Effective rps:       27639
Effective rps:       27727
```

### Linode

Dedicated 8 GB, $72/mo, 4 CPUs.
CPU: AMD EPYC 7713 64-Core Processor.
Result: **33 krps**, also very disappointing.

```
Effective rps:       29100
Effective rps:       31635
Effective rps:       32524
Effective rps:       32043
```

### Google Cloud

C2 (8 CPUs) $315/mo "ultra-high performance".
CPU: Intel(R) Xeon(R) CPU @ 3.10GHz.
Result: **64 krps**, not so ultra-high.

```
Effective rps:       64008
Effective rps:       62939
Effective rps:       63274
```

C2D: c2d-standard-8 $341/mo.
CPU: AMD EPYC 7B13.
Result: **79 krps**.

```
Effective rps:       76673
Effective rps:       79157
Effective rps:       73479
```

C3: c3-standard-8 $321/mo "consistently high performance"
CPU: Intel(R) Xeon(R) Platinum 8481C CPU @ 2.70GHz.
Result: **94 krps**, best of GCP.

```
Effective rps:       92161
Effective rps:       94349
Effective rps:       94015
```

C3: c3-standard-4 $160/mo.
CPU: Intel(R) Xeon(R) Platinum 8481C CPU @ 2.70GHz.
Result: **69 krps**.

```
Effective rps:       69463
Effective rps:       68472
Effective rps:       69188
```

N2: n2-standard-8 $312/mo "balanced price and performance".
CPU: Intel(R) Xeon(R) CPU @ 2.80GHz.
Result: **58 krps**, quite erratic.

```
Effective rps:       55098
Effective rps:       58464
Effective rps:       55662
```

### bun.sh

The new supposedly fast JS server framework, testing against a local nginx.
Cluster mode is not working yet, so cannot use the usual script `bin/tcp-performance.js`;
comparisons are using just one core to be fair.

Bun with keepalive, http mode: **14 krps**.

```
bun bin/loadtest.js http://localhost:80/ --cores 1 -k
Effective rps:       14401
```

For comparison, node with keepalive, http mode: **19 krps**, bit faster.

```
node bin/loadtest.js http://localhost:80/ --cores 1 -k
Effective rps:       18799
```

TCP mode was broken, after a [quick fix](https://github.com/alexfernandez/loadtest/commit/059423e0f5831d6bd63d33c600ab1ee3042af1a2),
bun with keepalive and tcp mode: **62 krps**.

```
bun bin/loadtest.js http://localhost:80/ --cores 1 -k --tcp
Effective rps:       62517
```

For comparison, node with keepalive and tcp mode: **60 krps**, bit slower.

```
node bin/loadtest.js http://localhost:80/ --cores 1 -k --tcp
Effective rps:       60231
```

bun.sh is a bit faster using plain TCP sockets!
But a bit slower using `http` mode.

## Other Options

Another useful benchmark: [performance](https://www.npmjs.com/package/performance),
specifically geared towards low level performance
(measures up to a nanosecond).

## Conclusions

Apple processors are not as performant as they are made to be:
a good Intel Core laptop i9 blows them out of the water.
Truth be told, I don't have results for M2 Max, M2 Pro or M2 Ultra
(hint, hint).

Cloud providers are sluggish at best, super expensive at worst.
Be sure to benchmark your intended instances as they can be charging > $300/mo
for a bunch of cores you will not be using,
or that will perform worse than you think.

Also, the new bun is promising, but is still not consistently faster
for TCP sockets.

If necessary, create your own synthetic benchmark,
`loadtest` can be of help here using its [powerful API](./api.md).

