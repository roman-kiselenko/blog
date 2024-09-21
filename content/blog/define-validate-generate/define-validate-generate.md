---
title: Define, Validate, Generate with CUE language
description: Short overview of cue language, how it works, which problems intended to resolve
date: 2023-10-04
image: cue-language.jpg
tags:
- golang
- yaml
- json
- cue
---

<div class="message-box">
<p>"There is nothing so useless as doing efficiently that which should not be done at all." – Peter Drucker
</div>

{% image "./cue-language.jpg", "cue language icon", [900] %}

In this article, I'll briefly explain how to use the [<code>CUE</code>](https://cuelang.org/) configuration language and how it might help you to keep consistent the <code>YAML</code>/<code>JSON</code> files by validating against the schema, reducing repetition, and many more.

> <small>Arguably, validation should be the foremost task of any configuration language. Most configuration languages, however, focus on boilerplate removal. CUE is different in that it takes the validation first stance.
>  [cuelang.org](https://cuelang.org/docs/usecases/configuration/)</small>

Lets start from a simple example:

{% codetitle "", "example.cue" %}

```cue
// Schema
[string]: {
    name:  *"buddy" | string
    count: >=0 & <=100 | number
}
```

In the file `example.cue` we define the _schema_  and the validation rules of our data.
The _schema_ states:
* `[string]` - is an any arbitrary key.
* `name` - default value is `"buddy"` _or_  the type is `string`.
* `count` - default value in between `0` and `100` _or_ the type is `number`.

That's good, we've the _schema_ of our data, let's check arbitrary `YAML` against the defined schema.

Here is an example of `YAML`, this example contains a bunch of errors related to the wrong value type:

{% codetitle "", "example.yaml" %}

```yaml
item:
  name: []
  count: "110"
```

Let's use the `cue vet` command:

```shell
cue vet example.yaml example.cue
item.count: 2 errors in empty disjunction:
item.count: conflicting values "110" and >=0 (mismatched types string and number):
    ./example.cue:4:17
    ./example.cue:6:12
    ./example.yaml:3:11
item.count: conflicting values "110" and number (mismatched types string and number):
    ./example.cue:4:17
    ./example.cue:6:26
    ./example.yaml:3:11
item.name: 2 errors in empty disjunction:
item.name: conflicting values "buddy" and [] (mismatched types string and list):
    ./example.cue:5:13
    ./example.yaml:2:10
item.name: conflicting values string and [] (mismatched types string and list):
    ./example.cue:5:23
    ./example.yaml:2:10
```

As you can see there are many errors, is about conflicting values, the `name` value must be `string`, and `"buddy"` is not equal `[]` and so on.
Lets fix our `example.yaml`

{% codetitle "", "example.yaml" %}

```yaml
item:
  name: "teammate"
  count: 110
```

We've changed our `example.yaml`, run `cue vet example.yaml example.cue` and there are no errors, but what about the _schema_ state `>=0 & <=100 | number`?
The _schema_ state is right, it denotes the value of the `count` key must be more or equal `0` and less or equal `100` or the `number` type,
and in our last changes `110` is a `number` type.

Lets adjunct the _schema_ a little to meet our requirements:

{% codetitle "", "example.cue" %}

```cue
// Schema
[string]: {
    name:  *"buddy" | string
    count: >=0 & <=100 & number // instead of '>=0 & <=100 | number'
}
```

Run `cue vet` again:

```shell
cue vet example.yaml example.cue
item.count: invalid value 110 (out of bound <=100):
    ./example.cue:6:18
    ./example.yaml:3:11
```

That's right.

Another things we can do is to move our _data_ closer to _schema_ and generate valid `YAML`/`JSON`.

Let's change `example.cue` a little:

{% codetitle "", "example.cue" %}

```cue
// Schema
[string]: {
    name:  *"buddy" | string
    count: >=0 & <=100 & number
}
// Data
example: {
  name: "somebody"
  count: 12
}
```

Now we able to generate a valid `YAML`/`JSON` from out data:

```yaml
cue export example.cue --out yaml
example:
  name: somebody
  count: 12
```

```json
cue export example.cue --out json
{
    "example": {
        "name": "somebody",
        "count": 12
    }
}
```

One of the cool things about `CUE` here is that it can infer default values for our data from the _schema_:

{% codetitle "", "example.cue" %}

```cue
// Schema
[string]: {
    name:  *"buddy" | string
    count: >=0 & <=100 & number
}
// Data
example: {
  count: 12
}
```

The code above generate next output:

```yaml
cue export example.cue --out yaml
example:
  name: buddy
  count: 12
```

We're working a lot with different types of configurations, and on many occasions,
that particular area is a mess, in most cases, the mess happens because of humans,
somewhere you chose the wrong type of particular field or just forgot some key, it takes the time from us.
There is no more precious thing in the world than time. In my opinion, the `CUE` can help here.

In this small article, I've scratched the surface of how `CUE` works and presented a small example with _schema_ definition and data validation.

Happy coding!
