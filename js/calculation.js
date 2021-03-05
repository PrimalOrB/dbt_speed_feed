import { sfmTable, materialTable } from './tables.js';

var output = {}

export function runCalculate(e) {
    return updateCalc(e)
}

function updateCalc(input) {
    // clear current output
    output = {}

    // adjust cutting tool definition by measure type to imperial
    if ( input.measure === "Metric" ) {
        var adjust = ['dia', 'radius', 'chamfer-depth']
        for ( var i = 0; i < adjust.length; i++ ) {
            input[`${adjust[i]}`] = input[`${adjust[i]}`] / 25.4
        }
    };

    // adjust cutting tool definition by measure type to imperial
    if ( input['cutting-measure'] === "Metric" ) {
        var adjust = ['depth-of-cut', 'step-over']
        for ( var i = 0; i < adjust.length; i++ ) {
            input[`${adjust[i]}`] = input[`${adjust[i]}`] / 25.4
        }
    };

        
    // find matching SFM table
    var filterInput = sfmTable.filter(lookup => lookup.series == input.series && lookup.material == input.material)
    
    // add inputs to filtered object
    Object.assign(filterInput[0],input)
    
    // add material selection data to filtered object
    var materialType = materialTable.filter( lookup => lookup.material === input.material )
    Object.assign(filterInput[0],materialType[0])
    
    // filter for series table
    filterInput[0].table = filterInput[0].table.filter(lookup => lookup.series == filterInput[0].series && lookup.material == filterInput[0].material)
    // interpolate FPT values from low and high dia ranges
    filterInput[0].fpt = interpolateFPT(filterInput[0])
    // calculate outputs
    output['effective-diameter'] = filterInput[0].dia;

   

    output['sfm'] = interpolateSFM(filterInput[0]);
    
    output['ipt'] = filterInput[0]['step-over'] >= ( filterInput[0].dia * 0.8 ) ? 
                    filterInput[0].fpt * 0.8 : 
                    filterInput[0].fpt;      
                             
    output['rpm'] = filterInput[0]['max-rpm'] === undefined ?
                    Math.round( output['sfm'] * 12 / Math.PI / filterInput[0].dia / 100 ) * 100 :
                    Math.round( Math.min( filterInput[0]['max-rpm'], output['sfm'] * 12 / Math.PI / filterInput[0].dia) / 100 ) *100;

                    console.log(filterInput[0], output)
                         
    output['ipm'] = output['ipt'] * output['rpm'] * filterInput[0]['num-teeth'];


    // apply chip thinning
    if(input.thinning){
        chipThin(output, filterInput[0])
    }
    // continue after chip thinning update
    output['removal'] = filterInput[0]['depth-of-cut'] * filterInput[0]['step-over'] * output['ipm'];
    if(filterInput[0]['specific-energy'] ) { 
        output['min-hp'] = ( output['removal'] * filterInput[0]['specific-energy'] ) / 0.75;
        output['spindle-tq']  = output['min-hp'] * 0.75 * 63030 / output['rpm'];
    };

    // adjust output if cutting parameters set to Metric
    if ( input['cutting-measure'] === "Metric" ) {
        var adjust = ['effective-diameter', 'ipt', 'ipm', 'actual-chip-thickness', 'combined-chip-thin', 'removal']
        for ( var i = 0; i < adjust.length; i++ ) {
            output[`${adjust[i]}`] = output[`${adjust[i]}`] * 25.4
        }
        output.mmpt = output.ipt
        delete output.ipt
        output.mmpm = output.ipm
        delete output.ipm
        output.smm = output.sfm * 3.28084
        delete output.sfm
    };


    return output
}

// Function to interpolate the feed per tooth (fpt) between key upper and lower diameter inputs
function interpolateFPT(obj){
    function lowMatch(obj) {
        var val = obj.table.filter(lookup => lookup['cut-dia'] <= obj.dia)
        val = val[val.length-1]
        return val
    }
    function highMatch(obj) {
        var val = obj.table.filter(lookup => lookup['cut-dia'] >= obj.dia)
        val = val[0]
        return val
    } 
    var a = lowMatch(obj)
    var b = highMatch(obj)

    
    if ( a.fpt !== b.fpt ) { 
        var ratio = (obj.dia - a['cut-dia']) / ( b['cut-dia'] - a['cut-dia'] )
        return ( ( b.fpt - a.fpt ) * ratio ) + a.fpt
    } else {
        return a.fpt
    }
};

// Function to interpolate SFM from tables
function interpolateSFM(obj) {
    var a = obj['min-sfm']
    var b = obj['max-sfm']
    var c = obj['aggression']
    return ( ( b - a ) * ( c/10 ) ) + a
};

// Apply chip thinning calculations
function chipThin(obj, input) {
    obj['radial-chip-thinning-factor'] = Math.sqrt( 1 - Math.pow(1 - ( ( 2 * input['step-over'] ) / input['dia'] ), 2 ) );
    obj['actual-chip-thickness'] = obj['ipt'] / obj['radial-chip-thinning-factor'];
    switch(input['tool-type']) {
        case 'FB': // FB Condiution
            thinningFB(obj, input);
            break
        case 'BN': // BN Condition
            thinningBN(obj, input);
            break
        case 'RAD': // RAD Condition
            thinningRAD(obj, input);
            break
    }
    return output
};

// FB Chip Thinning Calculations
function thinningFB(obj, input) {
    if( input['step-over'] < ( input['dia'] / 2 ) ) {
        obj['ipt'] = obj['actual-chip-thickness']
        obj['ipm'] = obj['ipm'] / obj['radial-chip-thinning-factor'];
    }
}

// BN Chip Thinning Calculations
function thinningBN(obj, input) {
    if ( input['depth-of-cut'] < input['dia'] / 2 ) {
        output['effective-diameter'] = 2 * Math.sqrt( Math.pow(input['dia'] / 2, 2) - Math.pow( ( input['dia'] / 2 ) - input['depth-of-cut'], 2 ) )
    }
    obj['axial-chip-thinning-factor'] = Math.sqrt( 1 - Math.pow( 1 - ( 2 * input['depth-of-cut'] ) / output['effective-diameter'], 2 ) );
    obj['combined-chip-thin'] = obj['axial-chip-thinning-factor'] * obj['radial-chip-thinning-factor'];
    if( obj['combined-chip-thin'] ) { 
        obj['actual-chip-thickness'] = obj['ipt'] / obj['combined-chip-thin']
    }
    obj['ipt'] = obj['actual-chip-thickness'];
    obj['rpm'] = Math.min( input['max-rpm'], Math.round( Math.max( obj['rpm'], obj['sfm'] * 12 / Math.PI / output['effective-diameter']) / 100 ) * 100);
    obj['ipm'] = obj['ipt'] * obj['rpm'] * input['num-teeth']
}

// RAD Chip Thinning Calculations
function thinningRAD(obj, input) {
    input['radius'] === input['radius'] || 0;
    if ( input['depth-of-cut'] < input['radius'] ) {
        if( input['dia'] - ( 2 * input['radius'] ) <= 0 ) {
        output['effective-diameter'] = 2 * Math.sqrt( Math.pow(input['radius'], 2) - Math.pow( input['radius'] - input['depth-of-cut'], 2 ) )
        } else {
            output['effective-diameter'] = 2 * Math.sqrt( Math.pow(input['radius'], 2) - Math.pow( input['radius'] - input['depth-of-cut'], 2 ) ) + ( input['dia'] - ( 2 * input['radius']))
        }
    }
    obj['ipt'] = input.fpt / obj['radial-chip-thinning-factor'];
    obj['rpm'] = Math.min( input['max-rpm'], Math.round( Math.max( obj['rpm'], obj['sfm'] * 12 / Math.PI / output['effective-diameter']) / 100 ) * 100);
    obj['ipm'] = obj['ipt'] * obj['rpm'] * input['num-teeth']
}
